import * as THREE from "three";
import { addAmbientDustZone } from "../AmbientParticles";
import Demo from "./Demo";

export default class DesertDemo extends Demo {
  modelName = "desert";
  envMapName = "envDesert";
  spawn = [
    new THREE.Vector3(
      -20.248270295839482,
      30.474685713014907,
      228.6331292366264
    ),
    new THREE.Euler(-0.20013325422857836, -0.6010142617371497, 0, "YXZ"),
  ];
  lut = true;
  size = 1367552;

  settings = {
    "color lut": true,
    compressionPass: false,
    fogColor: 7646920,
    fogDensity: 0.0012000000000000001,
    toneMapping: "4",
    toneMappingExposure: 0.8,
    gamma: 0.8500000000000001,
    hue: 0,
    saturation: 0.015,
    envMapIntensity: 1.74,
    lightMapIntensity: 1,
    aoMapIntensity: 0.93,
    roughness: 0.5,
    metalness: 0,
    aoPower: 2.2,
    aoSmoothing: 0,
    aoMapGamma: 1.1500000000000001,
    lightMapGamma: 1.1,
    envPower: 1.75,
    smoothingPower: 0.1,
    roughnessPower: 1.3,
    sunIntensity: 0,
    aoColor: 3621496,
    aoColorSaturation: 0.3714285714285714,
    hemisphereColor: 7820684,
    irradianceColor: 6267040,
    radianceColor: 16120319,
    sunColor: 16777215,
    mapContrast: 0.98,
    lightMapContrast: 1.16,
    irradianceIntensity: 7.03,
    radianceIntensity: 4.23,
    fov: 52,
    baseIor: 0.935,
    bandOffset: 0.0013000000000000002,
    jitterIntensity: 6.4,
    bloom1_intensity: 0.18,
    bloom1_luminanceThreshold: 0.66,
    bloom1_luminanceSmoothing: 0.55,
    bloom1_kernelSize: 3,
    bloom2_intensity: 1.28,
    bloom2_luminanceThreshold: 0.5,
    bloom2_luminanceSmoothing: 0.5,
    bloom2_kernelSize: 5,
  };

  // settings when no ao map
  settings = {
    "color lut": true,
    compressionPass: false,
    fogColor: 7646920,
    fogDensity: 0.0012000000000000001,
    toneMapping: "4",
    toneMappingExposure: 0.8,
    gamma: 0.9,
    hue: 0,
    saturation: 0.015,
    envMapIntensity: 1.74,
    lightMapIntensity: 1,
    aoMapIntensity: 0.93,
    roughness: 0.5,
    metalness: 0,
    aoPower: 2.2,
    aoSmoothing: 0.11,
    aoMapGamma: 0.91,
    lightMapGamma: 0.9400000000000001,
    envPower: 1.75,
    smoothingPower: 0.13,
    roughnessPower: 1.3,
    sunIntensity: 0,
    aoColor: 6915247,
    aoColorSaturation: 0.30434782608695654,
    hemisphereColor: 6849496,
    irradianceColor: 7313105,
    radianceColor: 10410751,
    sunColor: 16777215,
    mapContrast: 0.98,
    lightMapContrast: 1.19,
    irradianceIntensity: 7.84,
    radianceIntensity: 7.07,
    fov: 52,
    baseIor: 0.935,
    bandOffset: 0.0013000000000000002,
    jitterIntensity: 6.4,
    bloom1_intensity: 0.18,
    bloom1_luminanceThreshold: 0.66,
    bloom1_luminanceSmoothing: 0.55,
    bloom1_kernelSize: 3,
    bloom2_intensity: 1.28,
    bloom2_luminanceThreshold: 0.5,
    bloom2_luminanceSmoothing: 0.5,
    bloom2_kernelSize: 5,
  };

  init(scene) {
    addAmbientDustZone(225, 3, 289, 500, 500, 30000);

    scene.traverse((c) => {
      if (c.isMesh) c.material.aoMap = null;
      if (c.name === "water") {
        c.material.setValues({
          roughness: 0,
          metalness: 1,
          transparent: true,
          opacity: 0.15,
          side: THREE.DoubleSide,
        });

        c.material.color.multiplyScalar(2);
      }
    });
  }
}
