import * as THREE from "three"

export default class Demo {
	modelName = ""
	envMapName = ""
	setting = {}
	spawn = [new THREE.Vector3(), new THREE.Euler()]
	lut = false
	reflectionHideObjects = []
	reflectiveGroundOptions = {}
	envMapPos = new THREE.Vector3()
	envMapSize = new THREE.Vector3()
	sky = true
	materials = []
	collisions = true
	reflectiveFloorName = null
	height = 3
	size = 1

	init(scene) {
		scene.traverse(c => c.material && (console.log(c.name) || true) && this.materials.push(c.material))
	}

	getMaterialByName(name) {
		for (const mat of this.materials) {
			if (mat.name.split(".")[0] === name) return mat
		}
	}
}
