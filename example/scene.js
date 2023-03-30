import "./style/main.css"

import copy from "copy-to-clipboard"
import * as POSTPROCESSING from "postprocessing"
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from "postprocessing"
import * as THREE from "three"
import { DepthFormat, DepthTexture, FloatType, HalfFloatType, sRGBEncoding, UnsignedShortType } from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader"
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader"
import Toastify from "toastify-js"
import "toastify-js/src/toastify.css"
import { LensDistortionShader } from "./LensDistortionShader.js"
import dat from "dat.gui"
import { MotionBlurEffect, TRAAEffect, VelocityDepthNormalPass } from "realism-effects"
import Stats from "stats.js"
import { createAmbientDust } from "./AmbientParticles"
import { enhanceShaderLighting } from "enhance-shader-lighting"
import { GammaCorrectionEffect } from "./GammaCorrectionEffect"
import { MeshReflectorMaterial } from "./MeshReflectorMaterial"
import { controls, setMovementCamera, setSpawn, worldOctree } from "./Movement"
import { CompressionPass } from "./scenes/CompressionPass"
import DesertDemo from "./scenes/DesertDemo"
import GymDemo from "./scenes/GymDemo"
import TheBackroomsDemo from "./scenes/TheBackroomsDemo"
import { detectSupport, initLowResMaterial } from "./Utils"

let demo
let stats

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

export const initScene = name => {
	switch (name) {
		case "gym":
			demo = new GymDemo()
			break

		case "backrooms":
			demo = new TheBackroomsDemo()
			break

		case "desert":
			demo = new DesertDemo()
			break
	}

	console.time("Load")

	let generalParams
	let enhanceShaderLightingParams
	let bloomParams
	let configureMaterialParams
	let viewParams
	let reflectionOptions = {}
	const aoColorHsl = {}

	let isPickingMesh = false
	let pickedMesh

	let gui
	let guiElem

	// Scene
	const scene = new THREE.Scene()
	scene.updateMatrixWorld = () => {}
	scene.fog = new THREE.FogExp2(0, 0)

	const aoColor = new THREE.Color()
	const hemisphereColor = new THREE.Color()
	const irradianceColor = new THREE.Color()
	const radianceColor = new THREE.Color()
	const sunColor = new THREE.Color()

	// Camera
	const camera = new THREE.PerspectiveCamera(49, innerWidth / innerHeight, 0.1, 2000)
	camera.rotation.order = "YXZ"
	scene.add(camera)

	setMovementCamera(camera, scene, demo.height)

	const canvas = document.querySelector(".webgl")

	let rendererCanvas

	// use an offscreen canvas if available
	if (window.OffscreenCanvas) {
		rendererCanvas = canvas.transferControlToOffscreen()
		rendererCanvas.style = canvas.style
	} else {
		rendererCanvas = canvas
	}

	// this function  checks if webgl2 is available
	function isWebGL2Available() {
		try {
			const canvas = document.createElement("canvas")
			return !!(window.WebGL2RenderingContext && canvas.getContext("webgl2"))
		} catch (e) {
			return false
		}
	}

	const context = isWebGL2Available() ? rendererCanvas.getContext("webgl2") : undefined

	const renderer = new THREE.WebGLRenderer({
		canvas: rendererCanvas,
		context,
		powerPreference: "high-performance",
		premultipliedAlpha: false,
		depth: false,
		stencil: false,
		antialias: false,
		preserveDrawingBuffer: true
	})
	renderer.outputEncoding = sRGBEncoding

	renderer.setPixelRatio(window.devicePixelRatio)
	renderer.setSize(innerWidth, innerHeight)
	renderer.toneMapping = THREE.CineonToneMapping

	const listener = new THREE.AudioListener()
	camera.add(listener)

	window.scene = scene
	window.THREE = THREE
	window.renderer = renderer
	window.listener = listener

	let composer
	let zoom = 1

	const pmremGenerator = new THREE.PMREMGenerator(renderer)
	pmremGenerator.compileEquirectangularShader()

	const textureLoader = new THREE.TextureLoader()

	const raycaster = new THREE.Raycaster()

	const hueSaturationEffect = new POSTPROCESSING.HueSaturationEffect({
		saturation: 0
	})
	const vignetteEffect = new POSTPROCESSING.VignetteEffect({
		offset: 0.4,
		darkness: 0.65
	})
	const scanlineEffect = new POSTPROCESSING.ScanlineEffect({ density: 1.09 })
	scanlineEffect.blendMode.opacity.value = 0.00375
	const gammaCorrectionEffect = new GammaCorrectionEffect()
	const noiseEffect = new POSTPROCESSING.NoiseEffect({
		blendFunction: POSTPROCESSING.BlendFunction.MULTIPLY
	})
	noiseEffect.blendMode.opacity.value = 0.1675

	const size = 600

	const bloom1Options = {
		intensity: 1.6,
		blendFunction: POSTPROCESSING.BlendFunction.SCREEN,
		kernelSize: POSTPROCESSING.KernelSize.MEDIUM,
		luminanceThreshold: 0.6,
		luminanceSmoothing: 1,
		width: size,
		height: size
	}

	const bloom2Options = {
		intensity: 0.2,
		blendFunction: POSTPROCESSING.BlendFunction.SCREEN,
		kernelSize: POSTPROCESSING.KernelSize.HUGE,
		luminanceThreshold: 0.2,
		luminanceSmoothing: 0.6,
		width: size,
		height: size
	}

	const bloom1Effect = new BloomEffect(bloom1Options)
	const bloom2Effect = new BloomEffect(bloom2Options)

	let lutEffect = null
	let webgl1SmaaEffect = null

	const loadPromises = []

	loadPromises.push(
		new Promise(resolve => {
			if (demo.lut) {
				new POSTPROCESSING.LUT3dlLoader().load(demo.modelName + ".3dl", lutTexture => {
					lutEffect = new POSTPROCESSING.LUTEffect(lutTexture)
					// lutEffect.inputEncoding = THREE.LinearEncoding

					resolve()
				})
			} else {
				resolve()
			}
		})
	)

	loadPromises.push(
		new Promise(resolve => {
			if (renderer.capabilities.isWebGL2) {
				resolve()
			} else {
				const smaaImageLoader = new POSTPROCESSING.SMAAImageLoader()

				smaaImageLoader.load(([search, area]) => {
					webgl1SmaaEffect = new POSTPROCESSING.SMAAEffect(
						search,
						area,
						POSTPROCESSING.SMAAPreset.VERY_LOW,
						POSTPROCESSING.EdgeDetectionMode.COLOR
					)

					resolve()
				})
			}
		})
	)

	let lensDistortionMaterial
	let compressionPass

	Promise.all(loadPromises).then(() => {
		composer = new EffectComposer(renderer, {
			frameBufferType: HalfFloatType
		})

		window.composer = composer

		const renderPass = new RenderPass(scene, camera)
		composer.addPass(renderPass)

		const velocityDepthNormalPass = new VelocityDepthNormalPass(scene, camera)
		composer.addPass(velocityDepthNormalPass)

		// TRAA
		const traaEffect = new TRAAEffect(scene, camera, velocityDepthNormalPass)

		// Motion Blur
		// const motionBlurEffect = new MotionBlurEffect(velocityDepthNormalPass);

		const effects = [bloom1Effect, hueSaturationEffect, vignetteEffect]

		lensDistortionMaterial = new THREE.ShaderMaterial()
		Object.assign(lensDistortionMaterial, LensDistortionShader)

		lensDistortionMaterial.defines.CHROMA_SAMPLES = 24

		lensDistortionMaterial.uniforms.baseIor.value = 0.965
		lensDistortionMaterial.uniforms.bandOffset.value = 0.0015
		lensDistortionMaterial.uniforms.jitterIntensity.value = 5.375

		const lensDistortionPass = new POSTPROCESSING.ShaderPass(lensDistortionMaterial)
		const lensDistortionPassRender = lensDistortionPass.render
		lensDistortionPass.render = (renderer, inputBuffer, ...args) => {
			lensDistortionMaterial.uniforms.tDiffuse.value = inputBuffer.texture
			lensDistortionPassRender.call(lensDistortionPass, renderer, inputBuffer, ...args)
		}

		Object.defineProperty(lensDistortionMaterial, "useSrgbEncoding", {
			get: () => composer.passes.indexOf(lensDistortionPass) === composer.passes.length - 1
		})

		if (demo.settings.compressionPass === true && !isMobile) compressionPass = new CompressionPass()

		const mainEffects = [gammaCorrectionEffect, webgl1SmaaEffect].filter(effect => !!effect)

		if (!isMobile) mainEffects.unshift(traaEffect)
		if (!isMobile) mainEffects.push(bloom2Effect)

		if (demo.settings["color lut"] === true) effects.push(lutEffect)

		composer.addPass(new EffectPass(camera, ...mainEffects, ...effects, lutEffect))

		// composer.addPass(new EffectPass(camera, motionBlurEffect));
		if (!isMobile) composer.addPass(lensDistortionPass)

		const secondLast = composer.passes.length - 1
		if (demo.settings.compressionPass === true && !isMobile) compressionPass.addToComposer(composer, secondLast)
	})

	const anisotropy = renderer.capabilities.getMaxAnisotropy()

	const gltflLoader = new GLTFLoader()
	const draco = new DRACOLoader()
	draco.setDecoderConfig({ type: "js" })
	draco.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/")
	gltflLoader.setDRACOLoader(draco)

	let support = {}

	let skyMesh

	new RGBELoader().setDataType(FloatType).load("kloofendal_48d_partly_cloudy_1k.hdr", tex => {
		const skyGeo = new THREE.SphereBufferGeometry(400, 32, 32)
		const skyMat = new THREE.MeshBasicMaterial({
			map: tex,
			side: THREE.FrontSide,
			fog: false,
			color: new THREE.Color().setScalar(2)
		})
		skyMesh = new THREE.Mesh(skyGeo, skyMat)

		// make the sun position match the lightmap's sun position
		skyMesh.rotation.y = 4.941592653589794

		// otherwise it won't render it if the side is not set to FrontSide (so if we only see the backside of the mesh)
		skyMesh.geometry.scale(-1, -1, -1)
		skyMesh.scale.multiplyScalar(-1)

		skyMesh.name = "sky"

		scene.add(skyMesh)
	})

	const mixer = new THREE.AnimationMixer(camera)
	gltflLoader.load("cameraAnim.optimized.glb", asset => {
		asset.animations.forEach(clip => {
			camera.clip = mixer.clipAction(clip).play()
		})
	})

	const sceneViewMixer = new THREE.AnimationMixer(camera.parent)
	gltflLoader.load("sceneViewCameraAnim.optimized.glb", asset => {
		asset.animations.forEach(clip => {
			camera.cinematicClip = sceneViewMixer.clipAction(clip)
			camera.cinematicClip.timeScale = 0.5
		})
	})

	detectSupport().then(result => {
		support = result

		document.querySelector("#loading").style.display = "block"

		gltflLoader.load(demo.modelName + ".optimized.glb", setupWorldMesh, ev => {
			const progress = Math.round((ev.loaded / demo.size) * 100)
			document.querySelector("#loading").textContent = progress === 100 ? "Initialising..." : progress + "%"
		})
	})

	const materials = []

	const placeholderTexture = new RGBELoader().load("lightmap/placeholder.hdr")

	function setupWorldMesh(asset) {
		document.querySelector("#loading").remove()

		if (demo.collisions) {
			worldOctree.fromGraphNode(asset.scene)
		} else {
			worldOctree.fromGraphNode(new THREE.Mesh(new THREE.PlaneBufferGeometry(128, 128).rotateX(-Math.PI / 2)))
		}

		const mats = new Set()

		demo.init(asset.scene)
		setSpawn(demo.spawn)

		let sceneMeshes = new Set()
		asset.scene.traverse(c => c.isMesh && sceneMeshes.add(c))
		sceneMeshes = Array.from(sceneMeshes)

		const enhanceShaderLightingOptions = {
			...demo.settings,
			...{ aoColor, hemisphereColor, irradianceColor, radianceColor, sunColor }
		}

		asset.scene.traverse(c => {
			if (c.isMesh) {
				// for ray-casting
				c.geometry.computeBoundingBox()

				c.material.emissiveMap = c.material.emissiveMap || placeholderTexture
				const lightMap = c.material.emissiveMap

				// lightmap
				if (lightMap) {
					c.material.lightMap = lightMap
					c.material.emissiveMap = null

					lightMap.encoding = THREE.LinearEncoding

					c.material._originalLightMap = lightMap
				}

				// anisotropy
				if (c.material.map) c.material.map.anisotropy = anisotropy
				if (c.material.roughnessMap) c.material.roughnessMap.anisotropy = anisotropy
				if (c.material.metalnessMap) c.material.metalnessMap.anisotropy = anisotropy
				if (c.material.envMap) c.material.envMap.anisotropy = anisotropy
				if (c.material.lightMap) c.material.lightMap.anisotropy = anisotropy
				if (c.material.aoMap) c.material.aoMap.anisotropy = anisotropy

				if (c.name === demo.reflectiveFloorName) {
					if (isMobile) {
						c.material.envMapIntensity = 10
					} else {
						const options = demo.reflectiveGroundOptions
						const meshReflectorMaterial = new MeshReflectorMaterial(renderer, camera, scene, c, options)

						meshReflectorMaterial.onBeforeRenderReflections = () => {
							if (skyMesh) skyMesh.material.color.setScalar(5)

							if (!reflectionOptions.useLowResMeshes) return

							for (const reflectionHideObject of demo.reflectionHideObjects) {
								reflectionHideObject.visible = false
							}

							for (const mesh of sceneMeshes) {
								if (mesh.visible && mesh.userData.lowResMaterial) mesh.material = mesh.userData.lowResMaterial
							}
						}

						meshReflectorMaterial.onAfterRenderReflections = () => {
							if (skyMesh) skyMesh.material.visible = true
							if (skyMesh) skyMesh.material.color.setScalar(1)

							if (!reflectionOptions.useLowResMeshes) return

							for (const reflectionHideObject of demo.reflectionHideObjects) {
								reflectionHideObject.visible = true
							}

							for (const mesh of sceneMeshes) {
								if (mesh.visible && mesh.userData.lowResMaterial)
									mesh.material = generalParams["enhanceShaderLighting"]
										? mesh.enhanceShaderLightingMaterial
										: mesh.defaultMaterial
							}
						}

						c.userData.meshStandardMaterial = c.material
						const mat = c.userData.meshStandardMaterial

						c.material = meshReflectorMaterial
						c.material.setValues({
							map: mat.map,
							normalMap: mat.normalMap,
							aoMap: mat.aoMap,
							lightMap: mat.lightMap,
							roughnessMap: mat.roughnessMap,
							metalness: mat.metalness,
							roughness: mat.roughness,
							envMapIntensity: mat.envMapIntensity,
							normalScale: mat.normalScale,
							userData: { noValueOverride: true }
						})

						c.userData.meshReflectorMaterial = c.material

						const onBeforeCompile = c.material.onBeforeCompile.bind(c.material)

						c.material.onBeforeCompile = (shader, ...args) => {
							// useBoxProjectedEnvMap(shader, demo.envMapPos, demo.envMapSize);
							onBeforeCompile(shader, ...args)

							shader.fragmentShader = shader.fragmentShader
								.replace(
									"#include <roughnessmap_fragment>",
									THREE.ShaderChunk.roughnessmap_fragment.replaceAll(
										"texture2D( roughnessMap, vUv )",
										"texture2D( roughnessMap, vUv * 5. )"
									)
								)
								.replace(
									"#include <normal_fragment_maps>",
									THREE.ShaderChunk.normal_fragment_maps.replaceAll(
										"texture2D( normalMap, vUv )",
										"texture2D( normalMap, vUv * 5. )"
									)
								)
						}

						const onBeforeCompile2 = mat.onBeforeCompile
						mat.onBeforeCompile = (shader, ...args) => {
							enhanceShaderLighting(shader, enhanceShaderLightingOptions)
							onBeforeCompile2(shader, ...args)
						}

						mat.needsUpdate = true
						mats.add(mat)
					}
				}

				if (!(c.material instanceof MeshReflectorMaterial)) {
					c.defaultMaterial = c.material.clone()
					mats.add(c.defaultMaterial)
				}

				const { onBeforeCompile } = c.material

				c.material.onBeforeCompile = (shader, ...args) => {
					enhanceShaderLighting(shader, enhanceShaderLightingOptions)

					onBeforeCompile(shader, ...args)

					syncGui()
				}

				c.material.needsUpdate = true
				c.material.name = c.name

				if (!(c.material instanceof MeshReflectorMaterial)) c.enhanceShaderLightingMaterial = c.material

				mats.add(c.material)
			}
		})

		materials.push.apply(materials, Array.from(mats))

		// let promise
		//
		// if (support.avif) {
		//     promise = loadLightmaps("avif")
		// } else if (support.webp) {
		//     promise = loadLightmaps("webp")
		// } else {
		//     promise = loadLightmaps("png")
		// }

		for (const mesh of sceneMeshes) initLowResMaterial(mesh)

		createAmbientDust()

		new RGBELoader().load(demo.envMapName + ".hdr", tex => {
			const envMap = pmremGenerator.fromEquirectangular(tex).texture
			envMap.minFilter = THREE.LinearFilter

			scene.environment = envMap
		})

		pickedMesh = scene.getObjectByProperty("isMesh", true)

		scene.add(asset.scene)

		asset.scene.updateMatrixWorld()

		stats = new Stats()
		document.body.appendChild(stats.dom)

		render()
		createGui()
		syncGui()

		console.timeEnd("Load")
	}

	const clock = new THREE.Clock()
	let lastRenderTime = 0
	let delta

	function render() {
		const now = performance.now()
		delta = clock.getDelta()
		if (delta > 1 / 10) delta = 1 / 10

		stats.begin()

		mixer.update(delta)

		sceneViewMixer.update(delta)

		if (guiElem && guiElem.style.display !== "none") syncGui()

		const diff = Math.abs(zoom - camera.zoom)
		if (diff > 0.001) {
			camera.zoom = THREE.MathUtils.lerp(camera.zoom, zoom, delta * 5)
			camera.updateProjectionMatrix()
		}

		controls(delta)

		if (skyMesh) {
			skyMesh.visible = demo.sky

			skyMesh.position.copy(camera.parent.position)
			skyMesh.position.y -= 50
			skyMesh.updateMatrixWorld()
		}

		if (
			scene.getObjectByName(demo.reflectiveFloorName) &&
			scene.getObjectByName(demo.reflectiveFloorName).material.update
		) {
			scene.getObjectByName(demo.reflectiveFloorName).material.update()

			if (renderer.info.render.frame > 100) {
				const currentRenderTime = performance.now() - now

				const time = 0.9975 * lastRenderTime + currentRenderTime * 0.0025

				const renderTime = Math.round(time * 100) / 100

				reflectionOptions.renderTime = renderTime + " ms"

				lastRenderTime = time
			}
		}

		// lensDistortionMaterial.uniforms.jitterOffset.value =
		//   clock.elapsedTime / 1000;

		composer.render()

		stats.end()

		window.requestAnimationFrame(render)
	}

	function syncGui() {
		if (generalParams === undefined) return

		canvas.style.cursor = isPickingMesh ? "crosshair" : "grab"

		const uniformKeys = [
			"aoPower",
			"aoSmoothing",
			"aoMapGamma",
			"lightMapGamma",
			"envPower",
			"smoothingPower",
			"roughnessPower",
			"sunIntensity",
			"mapContrast",
			"lightMapContrast",
			"irradianceIntensity",
			"radianceIntensity",
			"lightMapSaturation"
		]

		for (const mat of materials) {
			const { uniforms } = renderer.properties.get(mat)
			if (uniforms) {
				for (const property of uniformKeys) {
					if (property in uniforms) {
						uniforms[property].value = enhanceShaderLightingParams[property]

						if (
							isMobile &&
							demo instanceof GymDemo &&
							property === "sunIntensity" &&
							mat.name === demo.reflectiveFloorName
						) {
							uniforms[property].value = 1
						}
					}
				}

				if (uniforms["envMapPosition"])
					uniforms["envMapPosition"].value.set(
						generalParams.envMapPosX,
						generalParams.envMapPosY,
						generalParams.envMapPosZ
					)
				if (uniforms["envMapSize"])
					uniforms["envMapSize"].value.set(
						generalParams.envMapSizeX,
						generalParams.envMapSizeY,
						generalParams.envMapSizeZ
					)
			}

			if (mat.name !== demo.reflectiveFloorName) {
				mat.envMapIntensity = generalParams.envMapIntensity
			}

			if (mat.userData.noValueOverride) continue

			mat.metalness = generalParams.metalness
			mat.roughness = generalParams.roughness
			mat.aoMapIntensity = generalParams.aoMapIntensity
			mat.lightMapIntensity = generalParams.lightMapIntensity
		}

		scene.fog.color.setHex(generalParams.fogColor)
		scene.fog.density = generalParams.fogDensity
		renderer.toneMappingExposure = generalParams.toneMappingExposure

		gammaCorrectionEffect.uniforms.get("gamma").value = generalParams.gamma
		hueSaturationEffect.uniforms.get("saturation").value = generalParams.saturation

		const oldFov = camera.fov
		camera.fov = viewParams.fov
		if (camera.fov !== oldFov) camera.updateProjectionMatrix()

		lensDistortionMaterial.uniforms.baseIor.value = viewParams.baseIor
		lensDistortionMaterial.uniforms.bandOffset.value = viewParams.bandOffset
		lensDistortionMaterial.uniforms.jitterIntensity.value = viewParams.jitterIntensity

		aoColor.setHex(enhanceShaderLightingParams.aoColor)
		enhanceShaderLightingParams.aoColorSaturation = aoColorHsl.s
		hemisphereColor.setHex(enhanceShaderLightingParams.hemisphereColor)
		irradianceColor.setHex(enhanceShaderLightingParams.irradianceColor)
		radianceColor.setHex(enhanceShaderLightingParams.radianceColor)
		sunColor.setHex(enhanceShaderLightingParams.sunColor)

		// bloom
		bloom1Effect.uniforms.get("intensity").value = bloomParams.bloom1_intensity
		bloom1Effect.kernelSize = bloomParams.bloom1_kernelSize
		bloom1Effect.luminanceMaterial.threshold = bloomParams.bloom1_luminanceThreshold
		bloom1Effect.luminanceMaterial.smoothing = bloomParams.bloom1_luminanceSmoothing

		bloom2Effect.uniforms.get("intensity").value = bloomParams.bloom2_intensity
		bloom2Effect.kernelSize = bloomParams.bloom2_kernelSize
		bloom2Effect.luminanceMaterial.threshold = bloomParams.bloom2_luminanceThreshold
		bloom2Effect.luminanceMaterial.smoothing = bloomParams.bloom2_luminanceSmoothing
	}

	function loadLightmaps(type, folder) {
		if (folder === undefined) folder = type

		if ((type === "webp" || type === "avif") && !support[type]) {
			Toastify({
				text: type.toUpperCase() + " not supported by the browser",
				duration: 1000,
				style: {
					background: "#500"
				},
				gravity: "bottom"
			}).showToast()

			return Promise.resolve()
		}

		const iterate = [
			[materials.find(mat => mat.name === "track"), "track_denoised"],
			[materials.find(mat => mat.name === "clouds"), "clouds_denoised"],
			[materials.find(mat => mat.name === "mountains"), "mountains_denoised"],
			[materials.find(mat => mat.name === "trackcollideable"), "track.collideable_denoised"]
		]

		const values = {
			anisotropy,
			flipY: false
		}

		const promises = []

		for (const [mat, texName] of iterate) {
			if (!mat) return Promise.resolve()

			if (mat[folder + "_lightMap"]) {
				mat.lightMap = mat[folder + "_lightMap"]
				mat.needsUpdate = true
			} else {
				const promise = new Promise(resolve => {
					textureLoader.load(
						"lightmap/" + folder + "/" + texName + "." + type,
						tex => {
							for (const val in values) {
								if (Array.isArray(values[val])) continue
								tex[val] = values[val]
							}

							mat.lightMap = tex

							tex.needsUpdate = true
							mat.needsUpdate = true

							mat[folder + "_lightMap"] = tex

							resolve()
						},
						resolve
					)
				})

				promises.push(promise)
			}
		}

		return Promise.all(promises).then(() => {
			Toastify({
				text: type.toUpperCase() + " lightmaps loaded",
				duration: 1000,
				style: {
					background: "#333"
				},
				gravity: "bottom"
			}).showToast()
		})
	}

	const refreshDisplay = () => {
		// source: https://stackoverflow.com/a/24602975/7626841
		for (let i = 0; i < Object.keys(gui.__folders).length; i++) {
			const key = Object.keys(gui.__folders)[i]
			for (let j = 0; j < gui.__folders[key].__controllers.length; j++) {
				gui.__folders[key].__controllers[j].updateDisplay()
			}
		}
	}

	const createGui = () => {
		gui = new dat.GUI()
		gui.width = 300

		guiElem = document.querySelector(".dg.ac")

		if (isMobile) guiElem.style.display = "none"

		generalParams = {
			"enhanceShaderLighting": true,
			"color lut": true,
			"compressionPass": false,
			"fogColor": scene.fog.color.getHex(),
			"fogDensity": scene.fog.density,
			"toneMapping": 3,
			"toneMappingExposure": renderer.toneMappingExposure,
			"gamma": 1,
			"hue": 0,
			"saturation": 0,
			"envMapIntensity": 1,
			"lightMapIntensity": 1,
			"aoMapIntensity": 1,
			"roughness": 0.53675,
			"metalness": 0,
			"envMapPosX": demo.envMapPos.x,
			"envMapPosY": demo.envMapPos.y,
			"envMapPosZ": demo.envMapPos.z,
			"envMapSizeX": demo.envMapSize.x,
			"envMapSizeY": demo.envMapSize.y,
			"envMapSizeZ": demo.envMapSize.z,
			"loadWebPLightmaps"() {
				// quality: 7
				loadLightmaps("webp")
			},
			"loadAvifLightmaps"() {
				// quality: 15
				loadLightmaps("avif")
			},
			"reset demo settings"() {
				generalParams.resetLighting()

				for (const prop in demo.settings) {
					if (prop in generalParams) {
						generalParams[prop] = demo.settings[prop]
					} else if (prop in enhanceShaderLightingParams) {
						enhanceShaderLightingParams[prop] = demo.settings[prop]
					} else if (prop in bloomParams) {
						bloomParams[prop] = demo.settings[prop]
					} else if (prop in viewParams) {
						viewParams[prop] = demo.settings[prop]
					}
				}

				renderer.toneMapping = parseInt(generalParams["toneMapping"])

				refreshDisplay()
			},
			"clipboard settings"() {
				const settings = {}

				for (const prop in generalParams) {
					if (prop === "enhanceShaderLighting" || typeof generalParams[prop] === "function") continue
					settings[prop] = generalParams[prop]
				}

				for (const prop in enhanceShaderLightingParams) {
					if (typeof enhanceShaderLightingParams[prop] === "function") continue
					settings[prop] = enhanceShaderLightingParams[prop]
				}

				for (const prop in viewParams) {
					if (typeof viewParams[prop] === "function") continue
					settings[prop] = viewParams[prop]
				}

				for (const prop in bloomParams) {
					if (typeof bloomParams[prop] === "function") continue
					settings[prop] = bloomParams[prop]
				}

				copy(JSON.stringify(settings, null, 2))

				Toastify({
					text: "Copied settings to clipboard",
					duration: 1000,
					style: {
						background: "#555"
					},
					gravity: "bottom"
				}).showToast()
			},
			"resetLighting"() {
				Object.assign(generalParams, {
					roughness: 0.53675,
					metalness: 0,
					lightMapIntensity: 1,
					aoMapIntensity: 1,
					envMapIntensity: 2.5,
					fogColor: 0,
					fogDensity: 0,
					toneMappingExposure: 1.3,
					gamma: 0.85
				})

				Object.assign(enhanceShaderLightingParams, {
					smoothingPower: 0.25,
					irradianceIntensity: Math.PI,
					radianceIntensity: 1
				})

				Object.assign(bloomParams, origBloomParams)

				// lightmaps are hue-corrected with "-7" to be less green and more red
				loadLightmaps("png")

				refreshDisplay()
			}
		}

		const generalFolder = gui.addFolder("general")
		generalFolder.add(generalParams, "enhanceShaderLighting").onChange(val => {
			if (val) {
				scene.traverse(c => {
					if (c.isMesh && c.enhanceShaderLightingMaterial) {
						c.material = c.enhanceShaderLightingMaterial
					}
				})
			} else {
				scene.traverse(c => {
					if (c.isMesh && c.defaultMaterial) {
						c.material = c.defaultMaterial
					}
				})
			}
		})

		if (demo.settings["color lut"] === true)
			generalFolder.add(generalParams, "color lut").onChange(val => {
				lutEffect.blendMode.setBlendFunction(val ? POSTPROCESSING.BlendFunction.SRC : POSTPROCESSING.BlendFunction.SKIP)
			})

		if (demo.compressionPass === true) {
			generalFolder.add(generalParams, "compressionPass").onChange(val => {
				if (val) {
					compressionPass.addToComposer(composer)
				} else {
					compressionPass.removeFromComposer(composer)
				}
			})
		}

		generalFolder.addColor(generalParams, "fogColor")
		generalFolder.add(generalParams, "fogDensity").step(0.0001).min(0).max(0.01)
		generalFolder.add(generalParams, "toneMappingExposure").min(0).max(5).step(0.0125)
		generalFolder
			.add(generalParams, "toneMapping", {
				NoToneMapping: 0,
				LinearToneMapping: 1,
				ReinhardToneMapping: 2,
				CineonToneMapping: 3,
				ACESFilmicToneMapping: 4
			})
			.onChange(val => (renderer.toneMapping = parseInt(val)))
		generalFolder.add(generalParams, "gamma").step(0.0125).min(0.5).max(1)
		generalFolder.add(generalParams, "saturation").step(0.005).min(-0.5).max(0.5)

		generalFolder.add(generalParams, "envMapIntensity").step(0.01).min(0).max(25)
		generalFolder.add(generalParams, "lightMapIntensity").step(0.01).min(0).max(1)
		generalFolder.add(generalParams, "aoMapIntensity").step(0.01).min(0).max(1)
		generalFolder.add(generalParams, "roughness").step(0.01).min(0).max(2)
		generalFolder.add(generalParams, "metalness").step(0.01).min(0).max(2)
		generalFolder.add(generalParams, "reset demo settings")
		generalFolder.add(generalParams, "clipboard settings")

		const lightMapFolder = gui.addFolder("lightmap")
		lightMapFolder.add(generalParams, "loadWebPLightmaps").name("WebP (456 KB)")
		lightMapFolder.add(generalParams, "loadAvifLightmaps").name("AVIF (368 KB)")
		lightMapFolder.add(generalParams, "envMapPosX").step(0.01).min(-100).max(100)
		lightMapFolder.add(generalParams, "envMapPosY").step(0.01).min(-100).max(100)
		lightMapFolder.add(generalParams, "envMapPosZ").step(0.01).min(-100).max(100)
		lightMapFolder.add(generalParams, "envMapSizeX").step(0.01).min(0).max(100)
		lightMapFolder.add(generalParams, "envMapSizeY").step(0.01).min(0).max(100)
		lightMapFolder.add(generalParams, "envMapSizeZ").step(0.01).min(0).max(100)

		if (demo.settings.aoColor) aoColor.setHex(demo.settings.aoColor).getHSL(aoColorHsl)

		enhanceShaderLightingParams = {
			aoPower: 2,
			aoSmoothing: 0,
			aoMapGamma: 1,
			lightMapGamma: 1,
			lightMapSaturation: 1,
			envPower: 2,
			smoothingPower: 0.25,
			roughnessPower: 1,
			sunIntensity: 0,
			aoColor: aoColor.getHex(),
			aoColorSaturation: 0,
			hemisphereColor: hemisphereColor.getHex(),
			irradianceColor: irradianceColor.getHex(),
			radianceColor: radianceColor.getHex(),
			sunColor: sunColor.getHex(),
			mapContrast: 1,
			lightMapContrast: 1,
			irradianceIntensity: Math.PI,
			radianceIntensity: 1
		}

		const enhanceShaderLightingFolder = gui.addFolder("enhanceShaderLighting")

		enhanceShaderLightingFolder.add(enhanceShaderLightingParams, "aoPower").step(0.05).min(0).max(12)
		enhanceShaderLightingFolder.add(enhanceShaderLightingParams, "aoSmoothing").step(0.01).min(0).max(1)
		enhanceShaderLightingFolder.add(enhanceShaderLightingParams, "aoMapGamma").step(0.01).min(0.5).max(1.5)
		enhanceShaderLightingFolder.add(enhanceShaderLightingParams, "lightMapGamma").step(0.01).min(0.5).max(1.5)
		enhanceShaderLightingFolder.add(enhanceShaderLightingParams, "lightMapSaturation").step(0.01).min(0).max(2.5)
		enhanceShaderLightingFolder.add(enhanceShaderLightingParams, "envPower").step(0.05).min(0).max(16)
		enhanceShaderLightingFolder.add(enhanceShaderLightingParams, "smoothingPower").step(0.01).min(0).max(1)
		enhanceShaderLightingFolder.add(enhanceShaderLightingParams, "roughnessPower").step(0.05).min(0).max(4)
		enhanceShaderLightingFolder.add(enhanceShaderLightingParams, "irradianceIntensity").step(0.01).min(0).max(10)
		enhanceShaderLightingFolder.add(enhanceShaderLightingParams, "radianceIntensity").step(0.01).min(0).max(10)

		enhanceShaderLightingFolder.add(enhanceShaderLightingParams, "sunIntensity").step(0.01).min(0).max(15)

		enhanceShaderLightingFolder.add(enhanceShaderLightingParams, "mapContrast").step(0.005).min(0.5).max(1.5)

		enhanceShaderLightingFolder.add(enhanceShaderLightingParams, "lightMapContrast").step(0.01).min(0.5).max(1.5)

		enhanceShaderLightingFolder
			.addColor(enhanceShaderLightingParams, "aoColor")
			.onChange(val => aoColor.setHex(val).getHSL(aoColorHsl))
		// enhanceShaderLightingFolder.add(enhanceShaderLightingParams, "aoColorSaturation").step(0.005).min(0).max(1).onChange(s => {
		//     aoColor.setHSL(aoColorHsl.h, s, aoColorHsl.l)

		//     enhanceShaderLightingParams.aoColor = aoColor.getHex()
		// }).listen()
		enhanceShaderLightingFolder.addColor(enhanceShaderLightingParams, "hemisphereColor")
		enhanceShaderLightingFolder.addColor(enhanceShaderLightingParams, "irradianceColor")
		enhanceShaderLightingFolder.addColor(enhanceShaderLightingParams, "radianceColor")

		bloomParams = {
			bloom1_intensity: bloom1Options.intensity,
			bloom1_luminanceThreshold: bloom1Options.luminanceThreshold,
			bloom1_luminanceSmoothing: bloom1Options.luminanceSmoothing,
			bloom1_kernelSize: bloom1Options.kernelSize,

			bloom2_intensity: bloom2Options.intensity,
			bloom2_luminanceThreshold: bloom2Options.luminanceThreshold,
			bloom2_luminanceSmoothing: bloom2Options.luminanceSmoothing,
			bloom2_kernelSize: bloom2Options.kernelSize
		}

		const origBloomParams = { ...bloomParams }

		const bloomFolder = gui.addFolder("bloom")
		bloomFolder.add(bloomParams, "bloom1_intensity").step(0.01).min(0).max(2)
		bloomFolder.add(bloomParams, "bloom1_luminanceThreshold").step(0.01).min(0).max(2)
		bloomFolder.add(bloomParams, "bloom1_luminanceSmoothing").step(0.01).min(0).max(2)
		bloomFolder.add(bloomParams, "bloom1_kernelSize").step(1).min(0).max(5)

		bloomFolder.add(bloomParams, "bloom2_intensity").step(0.01).min(0).max(2)
		bloomFolder.add(bloomParams, "bloom2_luminanceThreshold").step(0.01).min(0).max(2)
		bloomFolder.add(bloomParams, "bloom2_luminanceSmoothing").step(0.01).min(0).max(2)
		bloomFolder.add(bloomParams, "bloom2_kernelSize").step(1).min(0).max(5)

		viewParams = {
			fov: camera.fov,
			baseIor: lensDistortionMaterial.uniforms.baseIor.value,
			bandOffset: lensDistortionMaterial.uniforms.bandOffset.value,
			jitterIntensity: lensDistortionMaterial.uniforms.jitterIntensity.value
		}

		const viewFolder = gui.addFolder("camera and lens")
		viewFolder.add(viewParams, "fov").min(10).max(120).step(1)
		viewFolder.add(viewParams, "baseIor").min(0).max(1).step(0.001)
		viewFolder.add(viewParams, "bandOffset").min(0).max(0.025).step(0.0001)
		viewFolder.add(viewParams, "jitterIntensity").min(0).max(25).step(0.1)

		if (scene.getObjectByName(demo.reflectiveFloorName)) {
			const meshReflectorMaterial = scene.getObjectByName(demo.reflectiveFloorName).material
			if (meshReflectorMaterial instanceof MeshReflectorMaterial) {
				const res = meshReflectorMaterial.kawaseBlurPass.resolution

				const reflectiveFloorFolder = gui.addFolder("reflective floor")

				reflectionOptions = {
					renderTime: "-",
					useLowResMeshes: true,
					useReflector: true,
					resolution: meshReflectorMaterial.fbo1.width,
					blurWidth: res.baseSize.x,
					blurHeight: res.baseSize.y,
					blurKernelSize: 3
				}

				meshReflectorMaterial.kawaseBlurPass.kernelSize = reflectionOptions.blurKernelSize

				reflectiveFloorFolder.add(reflectionOptions, "renderTime").listen()

				reflectiveFloorFolder.add(reflectionOptions, "useLowResMeshes")

				reflectiveFloorFolder.add(reflectionOptions, "useReflector").onChange(val => {
					const floor = scene.getObjectByName(demo.reflectiveFloorName)
					floor.material = val ? floor.userData.meshReflectorMaterial : floor.userData.meshStandardMaterial
				})

				reflectiveFloorFolder.add(meshReflectorMaterial, "hasBlur")

				reflectiveFloorFolder
					.add(reflectionOptions, "resolution")
					.step(16)
					.min(16)
					.max(1024)
					.onChange(val => {
						meshReflectorMaterial.fbo1.setSize(val, val)

						meshReflectorMaterial.fbo1.depthTexture.dispose()

						meshReflectorMaterial.fbo1.depthTexture = new DepthTexture(val, val)
						meshReflectorMaterial.fbo1.depthTexture.format = DepthFormat
						meshReflectorMaterial.fbo1.depthTexture.type = UnsignedShortType
					})

				reflectiveFloorFolder
					.add(reflectionOptions, "blurWidth")
					.step(16)
					.min(16)
					.max(1024)
					.onChange(val => {
						meshReflectorMaterial.kawaseBlurPass.setSize(val, res.height)
						meshReflectorMaterial.kawaseBlurPass.resolution.baseWidth = val
						meshReflectorMaterial.kawaseBlurPass.resolution.width = val
						meshReflectorMaterial.kawaseBlurPass.resolutionX = val
						// meshReflectorMaterial.hasBlur = res.base.x + res.base.y > 0;
					})

				reflectiveFloorFolder
					.add(reflectionOptions, "blurHeight")
					.step(16)
					.min(16)
					.max(1024)
					.onChange(val => {
						meshReflectorMaterial.kawaseBlurPass.setSize(res.width, val)
						meshReflectorMaterial.kawaseBlurPass.resolution.baseHeight = val
						meshReflectorMaterial.kawaseBlurPass.resolution.height = val
						meshReflectorMaterial.kawaseBlurPass.resolutionY = val
						// meshReflectorMaterial.hasBlur = res.base.x + res.base.y > 0;
					})

				reflectiveFloorFolder
					.add(reflectionOptions, "blurKernelSize")
					.step(1)
					.min(0)
					.max(5)
					.onChange(val => {
						meshReflectorMaterial.kawaseBlurPass.kernelSize = val
					})

				const props = meshReflectorMaterial.reflectorProps

				reflectiveFloorFolder.add(props, "mirror").step(0.01).min(0).max(5)
				reflectiveFloorFolder.add(props, "mixBlur").step(0.01).min(0).max(10)
				reflectiveFloorFolder.add(props, "mixStrength").step(0.01).min(0).max(30)
				reflectiveFloorFolder.add(props, "minDepthThreshold").step(0.01).min(0.5).max(1.5)
				reflectiveFloorFolder.add(props, "maxDepthThreshold").step(0.01).min(0.5).max(1000)
				reflectiveFloorFolder.add(props, "depthScale").step(0.01).min(0).max(1)
				reflectiveFloorFolder.add(props, "depthToBlurRatioBias").step(0.01).min(0).max(1)
				reflectiveFloorFolder.add(props, "distortion").step(0.01).min(0).max(5)
				reflectiveFloorFolder.add(props, "mixContrast").step(0.01).min(0).max(2)
				reflectiveFloorFolder.add(props, "roughnessAdd").step(0.001).min(0).max(0.25)
				reflectiveFloorFolder.add(props, "reflectionPower").step(0.1).min(0).max(16)
				reflectiveFloorFolder.add(props, "envMapMixStrength").step(0.1).min(0).max(5)
				reflectiveFloorFolder.add(props, "reflectionSaturation").step(0.01).min(0).max(1)
			}
		}

		configureMaterialParams = {
			"pick mesh"() {
				isPickingMesh = true
			},
			"clipboard values"() {
				const { name, material } = pickedMesh

				const normalScale = material.normalScale
					? `normalScale: new THREE.Vector2(${material["normalScale"].x}, ${material["normalScale"].y})`
					: ""
				const colorScalar = configureMaterialParams["colorScalar"]
				const colorHex = colorScalar === 0 ? "0x" + material["color"].getHexString() : ""

				const output = `
            scene.getObjectByName("${name}").material.setValues({
                roughness: ${material["roughness"]},
                metalness: ${material["metalness"]},
                color: new THREE.Color(${colorHex})${colorScalar === 0 ? "" : ".setScalar(" + colorScalar + ")"},
                ${normalScale},
                userData: { noValueOverride: true }
            })
            `.trim()

				copy(output)

				Toastify({
					text: "Copied values to clipboard",
					duration: 1000,
					style: {
						background: "#555"
					},
					gravity: "bottom"
				}).showToast()
			},
			"aoMapIntensity": 0,
			"roughness": 0,
			"metalness": 0,
			"envMapIntensity": 0,
			"color": 0,
			"colorScalar": 0,
			"normalScale": 0
		}

		const configureMaterialFolder = gui.addFolder("configure material")
		configureMaterialFolder.add(configureMaterialParams, "pick mesh")
		configureMaterialFolder.add(configureMaterialParams, "clipboard values")

		configureMaterialFolder
			.add(configureMaterialParams, "roughness")
			.step(0.01)
			.min(0)
			.max(10)
			.onChange(val => {
				pickedMesh.material["roughness"] = val
			})
		configureMaterialFolder
			.add(configureMaterialParams, "metalness")
			.step(0.01)
			.min(0)
			.max(2)
			.onChange(val => {
				pickedMesh.material["metalness"] = val
			})
		configureMaterialFolder
			.add(configureMaterialParams, "envMapIntensity")
			.step(0.01)
			.min(0)
			.max(15)
			.onChange(val => {
				pickedMesh.material["envMapIntensity"] = val
			})

		configureMaterialFolder.addColor(configureMaterialParams, "color").onChange(val => {
			pickedMesh.material["color"].setHex(val).multiplyScalar(configureMaterialParams["colorScalar"])
		})

		configureMaterialFolder
			.add(configureMaterialParams, "colorScalar")
			.step(0.01)
			.min(0)
			.max(5)
			.onChange(val => {
				pickedMesh.material["color"].setScalar(val)
			})

		configureMaterialFolder
			.add(configureMaterialParams, "normalScale")
			.step(0.01)
			.min(0)
			.max(8)
			.onChange(val => {
				pickedMesh.material["normalScale"].setScalar(val)
			})

		generalFolder.open()
		enhanceShaderLightingFolder.open()

		generalParams["reset demo settings"]()
	}

	// events
	window.addEventListener("resize", () => {
		const { innerWidth, innerHeight } = window

		camera.aspect = innerWidth / innerHeight
		camera.updateProjectionMatrix()

		renderer.setPixelRatio(window.devicePixelRatio)

		renderer.setSize(innerWidth, innerHeight)
		composer.setSize(innerWidth, innerHeight)
	})

	window.addEventListener("mousewheel", ev => {
		if (document.pointerLockElement !== document.body) return

		zoom += ev.deltaY < 0 ? 0.5 : -0.5
		zoom = THREE.MathUtils.clamp(zoom, 1, 5)
	})

	document.querySelector(".webgl").addEventListener("mousedown", ev => {
		if (isPickingMesh) {
			const pointer = new THREE.Vector2()

			pointer.x = (ev.clientX / window.innerWidth) * 2 - 1
			pointer.y = -(ev.clientY / window.innerHeight) * 2 + 1

			raycaster.setFromCamera(pointer, camera)
			const intersect = raycaster.intersectObjects(scene.children)[0]

			if (intersect && intersect.object.isMesh) {
				const mesh = intersect.object

				for (const prop in configureMaterialParams) {
					if (prop in mesh.material) {
						const attribute = mesh.material[prop]

						if (typeof attribute === "number") {
							configureMaterialParams[prop] = attribute
						} else if (attribute instanceof THREE.Vector2) {
							configureMaterialParams[prop] = attribute.x
						} else if (attribute instanceof THREE.Color) {
							configureMaterialParams[prop] = attribute.getHex()
						}
					}
				}

				configureMaterialParams["colorScalar"] = 0

				pickedMesh = mesh
				pickedMesh.material.userData.noValueOverride = true
				isPickingMesh = false

				refreshDisplay()
			}
		} else {
			document.body.requestPointerLock()
		}
	})

	document.addEventListener("mousedown", ev => {
		if (ev.which !== 3 || document.pointerLockElement !== document.body) return

		canvas.style.filter = canvas.style.filter === "blur(12px)" ? "none" : "blur(12px)"
	})

	document.addEventListener("pointerlockchange", () => {
		if (document.pointerLockElement === document.body && guiElem) {
			guiElem.display = "none"
			stats.dom.style.display = "none"
			gui.hide()
		} else {
			guiElem.display = "initial"
			stats.dom.style.display = "block"
			gui.show()
		}
	})

	document.addEventListener("keydown", event => {
		if (event.code === "KeyR") {
			generalParams["reset demo settings"]()
		}
	})
}
