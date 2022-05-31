import * as THREE from 'three'
import Demo from "./Demo";

export default class GeneralLightTestDemo extends Demo {
  modelName = "general_light_test";
  envMapName = "envTest";

  spawn = [new THREE.Vector3(15.327667105028647, -3.8338419236682206, -8.355795161584005), new THREE.Euler(0, 1.176407346410229, 0, "YXZ")];
  size = 23395180

  settings = {
    "color lut": true,
    "compressionPass": false,
    "fogColor": 7373462,
    "fogDensity": 0,
    "toneMapping": 3,
    "toneMappingExposure": 1.2000000000000002,
    "gamma": 0.9,
    "hue": 0,
    "saturation": 0,
    "envMapIntensity": 2.57,
    "lightMapIntensity": 1,
    "aoMapIntensity": 0.63,
    "roughness": 1,
    "metalness": 0,
    "aoPower": 2.1,
    "aoSmoothing": 0,
    "aoMapGamma": 1,
    "lightMapGamma": 1,
    "envPower": 2,
    "smoothingPower": 0.36,
    "roughnessPower": 1,
    "sunIntensity": 0,
    "aoColor": 1841689,
    "aoColorSaturation": 0.05660377358490566,
    "hemisphereColor": 7577013,
    "irradianceColor": 13419445,
    "radianceColor": 11507076,
    "sunColor": 16777215,
    "mapContrast": 1,
    "lightMapContrast": 1.06,
    "irradianceIntensity": 1.86,
    "radianceIntensity": 0,
    "fov": 49,
    "baseIor": 0.965,
    "bandOffset": 0.0015,
    "jitterIntensity": 5.375,
    "bloom1_intensity": 1.6,
    "bloom1_luminanceThreshold": 0.6,
    "bloom1_luminanceSmoothing": 1,
    "bloom1_kernelSize": 2,
    "bloom2_intensity": 0.2,
    "bloom2_luminanceThreshold": 0.2,
    "bloom2_luminanceSmoothing": 0.6,
    "bloom2_kernelSize": 5
  }
}