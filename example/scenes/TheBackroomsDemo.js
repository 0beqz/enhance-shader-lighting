import * as THREE from "three";
import { addAmbientDustZone } from "../AmbientParticles";
import { useBoxProjectedEnvMap } from "../BoxProjectedEnvMapHelper";
import Demo from "./Demo";

export default class TheBackroomsDemo extends Demo {
  modelName = "backrooms";
  envMapName = "envBackrooms";
  spawn = [
    new THREE.Vector3(
      1.1600598367661807,
      1.3499999999999517,
      -1.6470636640412124
    ),
    new THREE.Euler(0.0019999999999999792, -1.5780000000000005, 0, "YXZ"),
  ];
  lut = true;
  envMapPos = new THREE.Vector3(0, 0.851841, 0);
  envMapSize = new THREE.Vector3(17.035 * 2, 3.73277 + 0.5, 17.035 * 2);
  sky = false;
  height = 1.5;
  size = 1549728;

  settings = {
    "color lut": true,
    compressionPass: true,
    fogColor: 7373462,
    fogDensity: 0,
    toneMapping: "3",
    toneMappingExposure: 1.35,
    gamma: 0.9,
    hue: 0,
    saturation: 0.03,
    envMapIntensity: 7.1000000000000005,
    lightMapIntensity: 1,
    aoMapIntensity: 1,
    roughness: 0.67,
    metalness: 0.13,
    aoPower: 4.95,
    aoSmoothing: 0.44,
    aoMapGamma: 1.24,
    lightMapGamma: 0.97,
    envPower: 3.7,
    smoothingPower: 0.66,
    roughnessPower: 1.05,
    sunIntensity: 2.25,
    aoColor: 5587997,
    aoColorSaturation: 0.4912280701754386,
    hemisphereColor: 1384469,
    irradianceColor: 13486753,
    radianceColor: 10788496,
    sunColor: 16777215,
    mapContrast: 0.835,
    lightMapContrast: 1.05,
    irradianceIntensity: 3.8200000000000003,
    radianceIntensity: 3.43,
    fov: 83,
    baseIor: 0.8280000000000001,
    bandOffset: 0.0026000000000000003,
    jitterIntensity: 5.1000000000000005,
    bloom1_intensity: 0.3,
    bloom1_luminanceThreshold: 0.64,
    bloom1_luminanceSmoothing: 1,
    bloom1_kernelSize: 2,
    bloom2_intensity: 0.6900000000000001,
    bloom2_luminanceThreshold: 0.09,
    bloom2_luminanceSmoothing: 0.19,
    bloom2_kernelSize: 5,
  };

  init(scene) {
    addAmbientDustZone(0, -0.5, 0, this.envMapSize.x, this.envMapSize.z, 500);

    const audioLoader = new THREE.AudioLoader();

    let d = 1.5;

    const positions = [
      [-this.envMapSize.x + d, 5, -this.envMapSize + d],
      [+this.envMapSize.x - d, 5, +this.envMapSize - d],
      [-this.envMapSize.x + d, 5, +this.envMapSize - d],
      [+this.envMapSize.x - d, 5, -this.envMapSize + d],
    ];
    for (let i = 0; i < 4; i++) {
      audioLoader.load("audio/hum.mp3", (buffer) => {
        let sound = new THREE.PositionalAudio(window.listener);

        sound.setVolume(0.3);
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setRefDistance(17);

        sound.position.fromArray(positions[i]);
        scene.add(sound);
        sound.updateMatrixWorld();

        sound.play();
      });
    }

    let stepsSound;

    // audio by: https://freesound.org/people/MinigunFiend/
    audioLoader.load("audio/steps.wav", (buffer) => {
      stepsSound = new THREE.PositionalAudio(window.listener);
      stepsSound.position.set(
        this.envMapSize.x - 8,
        7,
        -this.envMapSize.z + 0.75
      );
      scene.add(stepsSound);
      stepsSound.updateMatrixWorld();

      stepsSound.setVolume(0.25);
      stepsSound.setBuffer(buffer);
      stepsSound.setRefDistance(17);
    });

    setTimeout(() => {
      stepsSound.play();

      setInterval(() => {
        setTimeout(() => {
          stepsSound.stop().play();

          stepsSound.position.set(
            2 * this.envMapSize.x * Math.random() - this.envMapSize.x,
            7,
            2 * this.envMapSize.z * Math.random() - this.envMapSize.z
          );
        }, Math.random() * 12500 + 3000);
      }, 20000);
    }, 5000 + 7000 * Math.random());

    scene.traverse((c) => {
      if (c.isMesh)
        c.material.onBeforeCompile = (shader) =>
          useBoxProjectedEnvMap(shader, this.envMapPos, this.envMapSize);
    });

    scene.getObjectByName("MG_Walls003").material.setValues({
      roughness: 0.12,
      metalness: 0,
      color: new THREE.Color(0xffffff),
      normalScale: new THREE.Vector2(1.49, 1.49),
      userData: { noValueOverride: true },
    });

    scene.getObjectByName("MG_Walls003_1").material.setValues({
      roughness: 0.79,
      metalness: 0.18,
      color: new THREE.Color(0xffffff),
      normalScale: new THREE.Vector2(2.56, 2.56),
      userData: { noValueOverride: true },
    });

    scene.getObjectByName("MG_Walls003_2").material.setValues({
      roughness: 1.06,
      metalness: 0.13,
      color: new THREE.Color(0xffffff),
      normalScale: new THREE.Vector2(3.48, 3.48),
      userData: { noValueOverride: true },
    });
  }
}
