import * as THREE from "three"
import { addAmbientDustZone } from "../AmbientParticles"
import { useBoxProjectedEnvMap } from "../BoxProjectedEnvMapHelper"
import Demo from "./Demo"

export default class GymDemo extends Demo {
	modelName = "gym"
	envMapName = "envGym"
	spawn = [new THREE.Vector3(9.357940673828125, 3, -25), new THREE.Euler(0, -Math.PI, 0, "YXZ")]
	lut = true
	envMapSize = new THREE.Vector3(38 - 0.05, 25, 67 - 0.05)
	envMapPos = new THREE.Vector3(9.35794, 1, -2.42829)
	reflectiveFloorName = "floor"
	collisions = false
	size = 5801280

	reflectiveGroundOptions = {
		resolution: 256,
		blur: [1024, 80],
		mixBlur: 5.78,
		mixStrength: 4.5,
		roughnessAdd: 0,
		mixContrast: 1,
		depthToBlurRatioBias: 0.34,
		reflectionPower: 9,
		envMapMixStrength: 1.9,
		reflectionSaturation: 0.6,
		planeNormal: new THREE.Vector3(0, 1, 0)
	}

	settings = {
		"color lut": true,
		"compressionPass": false,
		"fogColor": 7373462,
		"fogDensity": 0.0012,
		"toneMapping": 3,
		"toneMappingExposure": 1.8125,
		"gamma": 0.8,
		"hue": 0,
		"saturation": 0.29,
		"envMapIntensity": 7.7700000000000005,
		"lightMapIntensity": 1,
		"aoMapIntensity": 1,
		"roughness": 0.84,
		"metalness": 0.13,
		"envMapPosX": 9.35794,
		"envMapPosY": 1,
		"envMapPosZ": -2.42829,
		"envMapSizeX": 37.95,
		"envMapSizeY": 25,
		"envMapSizeZ": 66.95,
		"aoPower": 9.700000000000001,
		"aoSmoothing": 0.26,
		"aoMapGamma": 0.89,
		"lightMapGamma": 0.9,
		"lightMapSaturation": 1,
		"envPower": 1,
		"smoothingPower": 0.76,
		"roughnessPower": 1.4500000000000002,
		"sunIntensity": 0,
		"aoColor": 5066555,
		"aoColorSaturation": 0.14492753623188404,
		"hemisphereColor": 14730675,
		"irradianceColor": 7898230,
		"radianceColor": 9809301,
		"sunColor": 16777215,
		"mapContrast": 0.93,
		"lightMapContrast": 1.03,
		"irradianceIntensity": 6.59,
		"radianceIntensity": 4.62,
		"fov": 56,
		"baseIor": 0.935,
		"bandOffset": 0.0011,
		"jitterIntensity": 4,
		"bloom1_intensity": 1.53,
		"bloom1_luminanceThreshold": 0.64,
		"bloom1_luminanceSmoothing": 1.55,
		"bloom1_kernelSize": 3,
		"bloom2_intensity": 0.25,
		"bloom2_luminanceThreshold": 0.32,
		"bloom2_luminanceSmoothing": 0.5,
		"bloom2_kernelSize": 5
	}

	init(scene) {
		addAmbientDustZone(0, -3, 0, 40, 70, 500)

		scene.traverse(c => {
			if (c.isMesh)
				c.material.onBeforeCompile = shader => useBoxProjectedEnvMap(shader, this.envMapPos, this.envMapSize)
		})

		scene.getObjectByName("floor").material.setValues({
			envMapIntensity: 2.65,
			roughness: 2.26,
			metalness: 0.23,
			normalScale: new THREE.Vector2(1.5, 1.5),
			userData: { noValueOverride: true }
		})

		scene.getObjectByName("props").material.setValues({
			roughness: 0.62,
			metalness: 0.16,
			normalScale: new THREE.Vector2(1, 1),
			userData: { noValueOverride: true }
		})

		scene.getObjectByName("props2_4").material.setValues({
			roughness: 0.67,
			metalness: 0.16,
			normalScale: new THREE.Vector2(1, 1),
			userData: { noValueOverride: true }
		})

		for (let i = 1; i < 7; i++) {
			scene.getObjectByName("exterior_" + i).material.setValues({
				roughness: 0.84,
				metalness: 0.12,
				normalScale: new THREE.Vector2(1, 1),
				userData: { noValueOverride: true }
			})
		}

		scene.getObjectByName("exterior_3").material.setValues({
			normalScale: new THREE.Vector2(0.48, 0.48)
		})

		scene.getObjectByName("props2_5").material.setValues({
			roughness: 0.53,
			metalness: 0.04,
			normalScale: new THREE.Vector2(1, 1),
			userData: { noValueOverride: true }
		})

		scene.getObjectByName("props2_2").material.setValues({
			roughness: 0.48,
			metalness: 0.55,
			normalScale: new THREE.Vector2(1, -1),
			userData: { noValueOverride: true }
		})

		scene.getObjectByName("props2_3").material.setValues({
			roughness: 0.79,
			metalness: 0.13,
			normalScale: new THREE.Vector2(0.39, 0.39),
			userData: { noValueOverride: true }
		})

		this.reflectionHideObjects.push(
			// scene.getObjectByName("props2_5"),
			scene.getObjectByName("props2_2"),
			scene.getObjectByName("props2_4"),
			scene.getObjectByName("exterior_2"),
			scene.getObjectByName("exterior_6"),
			scene.getObjectByName("exterior_5"),
			scene.getObjectByName("exterior_4")
		)
	}
}
