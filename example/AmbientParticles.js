import * as THREE from "three"

let dustParticleZones = []
const textureLoader = new THREE.TextureLoader()

const map = textureLoader.load("particle.png")

const ambientParticlesMat = new THREE.MeshBasicMaterial({
	map,
	alphaMap: map,
	transparent: true,
	depthWrite: false,
	opacity: 0.5
})

ambientParticlesMat.onBeforeCompile = patchAmbientParticles

export function addAmbientDustZone(centerX, centerY, centerZ, sizeX, sizeZ, particleCount = 280) {
	dustParticleZones.push({
		centerX,
		centerY,
		centerZ,
		sizeX,
		sizeZ,
		particleCount
	})
}

export function createAmbientDust() {
	let count = 0
	dustParticleZones.forEach(dustParticleZone => (count += dustParticleZone.particleCount))

	const ambientParticles = new THREE.InstancedMesh(new THREE.PlaneBufferGeometry(1, 1, 1), ambientParticlesMat, count)
	ambientParticles.frustumCulled = false
	ambientParticles.name = "ambientParticles"

	const brightColor = new THREE.Color(0xffffff)

	let index = 0

	for (const dustParticleZone of dustParticleZones) {
		for (var i = 0; i < dustParticleZone.particleCount; i++) {
			ambientParticles.position.set(
				dustParticleZone.sizeX * Math.random() - dustParticleZone.sizeX / 2 + dustParticleZone.centerX,
				dustParticleZone.centerY + 45 * Math.random(),
				dustParticleZone.sizeZ * Math.random() - dustParticleZone.sizeZ / 2 + dustParticleZone.centerZ
			)

			const scale = 0.05 * Math.random() + 0.05

			ambientParticles.scale.set(scale, scale, scale)

			ambientParticles.rotation.set(0, 0, 0)

			ambientParticles.updateMatrix()

			ambientParticles.setMatrixAt(index + i, ambientParticles.matrix)
			ambientParticles.setColorAt(index + i, brightColor)
		}

		index += i
	}

	ambientParticles.position.set(0, 0, 0)
	ambientParticles.scale.set(1, 1, 1)
	ambientParticles.updateMatrix()

	window.scene.add(ambientParticles)

	dustParticleZones = []

	return ambientParticles
}

function patchAmbientParticles(shader) {
	shader.uniforms.time = {
		get value() {
			return performance.now() / 50000
		}
	}

	shader.vertexShader =
		"varying float particleDepth;\n" +
		"uniform float time;\n" +
		shader.vertexShader.replace(
			"#include <project_vertex>",
			/* glsl */ `
        vec4 mvPosition = vec4( transformed, 1.0 );
        mat4 transformInstanceMatrix = mat4(instanceMatrix);

        float seed = transformInstanceMatrix[3][1] * transformInstanceMatrix[3][2] - transformInstanceMatrix[3][0];

        transformInstanceMatrix[3][0] += cos(time + seed) * 15. - 7.5;
        transformInstanceMatrix[3][1] += sin(time + seed) * 9.;
        transformInstanceMatrix[3][2] += cos(time + seed) * 7.5 - 7.5;
        
        mvPosition = modelViewMatrix * transformInstanceMatrix * inverse(viewMatrix) * mvPosition;

        gl_Position = projectionMatrix * mvPosition;

        particleDepth = -mvPosition.z * 0.25;
        `
		)

	shader.fragmentShader =
		"varying float particleDepth;\n" +
		shader.fragmentShader.replace("#include <map_fragment>", THREE.ShaderChunk.map_fragment).replace(
			"diffuseColor *= sampledDiffuseColor;",
			/* glsl */ `
            diffuseColor *= sampledDiffuseColor;
            float depthOpacity = clamp(particleDepth * particleDepth, 0., 1.);
            diffuseColor.a *= depthOpacity * depthOpacity;
        `
		)
}
