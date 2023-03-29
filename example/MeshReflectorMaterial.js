﻿import * as THREE from "three";
import {
  DepthFormat,
  DepthTexture,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  PerspectiveCamera,
  Plane,
  UnsignedShortType,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from "three";
import * as POSTPROCESSING from "postprocessing";

class MeshReflectorMaterial extends THREE.MeshStandardMaterial {
  constructor(
    renderer,
    camera,
    scene,
    object,
    {
      mixBlur = 0,
      mixStrength = 1,
      resolution = 256,
      blur = [0, 0],
      minDepthThreshold = 0.9,
      maxDepthThreshold = 1,
      depthScale = 1,
      depthToBlurRatioBias = 0.25,
      mirror = 0,
      distortion = 1,
      mixContrast = 1,
      distortionMap,
      reflectorOffset = 0,
      roughnessAdd = 0,
      reflectionPower = 1,
      envMapMixStrength = 1,
      reflectionSaturation = 0.775,
      bufferSamples = 8,
      planeNormal = new THREE.Vector3(0, 0, 1),
    } = {}
  ) {
    super();

    this.gl = renderer;
    this.camera = camera;
    this.scene = scene;
    this.parent = object;

    this.hasBlur = blur[0] + blur[1] > 0;
    this.reflectorPlane = new Plane();
    this.normal = new Vector3();
    this.reflectorWorldPosition = new Vector3();
    this.cameraWorldPosition = new Vector3();
    this.rotationMatrix = new Matrix4();
    this.lookAtPosition = new Vector3(0, -1, 0);
    this.clipPlane = new Vector4();
    this.view = new Vector3();
    this.target = new Vector3();
    this.q = new Vector4();
    this.textureMatrix = new Matrix4();
    this.virtualCamera = new PerspectiveCamera();
    this.reflectorOffset = reflectorOffset;
    this.planeNormal = planeNormal;

    this.setupBuffers(resolution, blur, bufferSamples);

    this.reflectorProps = {
      mirror,
      textureMatrix: this.textureMatrix,
      mixBlur,
      tDiffuse: this.fbo1.texture,
      tDepth: this.fbo1.depthTexture,
      tDiffuseBlur: this.fbo2.texture,
      hasBlur: this.hasBlur,
      mixStrength,
      minDepthThreshold,
      maxDepthThreshold,
      depthScale,
      depthToBlurRatioBias,
      distortion,
      distortionMap,
      mixContrast,
      roughnessAdd,
      reflectionPower,
      envMapMixStrength,
      reflectionSaturation,
      "defines-USE_BLUR": this.hasBlur ? "" : undefined,
      "defines-USE_DEPTH": depthScale > 0 ? "" : undefined,
      "defines-USE_DISTORTION": distortionMap ? "" : undefined,
    };
  }

  setupBuffers(resolution, blur, bufferSamples) {
    const parameters = {
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      type: HalfFloatType,
      encoding: this.gl.outputEncoding,
    };

    const fbo1 = new WebGLRenderTarget(resolution, resolution, parameters);
    fbo1.depthBuffer = true;
    fbo1.depthTexture = new DepthTexture(resolution, resolution);
    fbo1.depthTexture.format = DepthFormat;
    fbo1.depthTexture.type = UnsignedShortType;

    const fbo2 = new WebGLRenderTarget(resolution, resolution, parameters);

    if (this.gl.capabilities.isWebGL2) {
      fbo1.samples = bufferSamples;
    }

    this.fbo1 = fbo1;
    this.fbo2 = fbo2;

    this.kawaseBlurPass = new POSTPROCESSING.KawaseBlurPass({
      width: blur[0],
      height: blur[1],
      resolutionX: blur[0],
      resolutionY: blur[1],
    });
    this.kawaseBlurPass.kernelSize = 1;
    this.kawaseBlurPass.setSize(blur[0], blur[1]);

    window.kawaseBlurPass = this.kawaseBlurPass;
    window.POSTPROCESSING = POSTPROCESSING;
  }

  beforeRender() {
    if (!this.parent) return;

    this.reflectorWorldPosition.setFromMatrixPosition(this.parent.matrixWorld);
    this.cameraWorldPosition.setFromMatrixPosition(this.camera.matrixWorld);
    this.rotationMatrix.extractRotation(this.parent.matrixWorld);

    // was changed from this.normal.set(0, 0, 1)
    this.normal.copy(this.planeNormal);
    this.normal.applyMatrix4(this.rotationMatrix);
    this.reflectorWorldPosition.addScaledVector(
      this.normal,
      this.reflectorOffset
    );
    this.view.subVectors(this.reflectorWorldPosition, this.cameraWorldPosition);
    // Avoid rendering when reflector is facing away
    if (this.view.dot(this.normal) > 0) return;
    this.view.reflect(this.normal).negate();
    this.view.add(this.reflectorWorldPosition);
    this.rotationMatrix.extractRotation(this.camera.matrixWorld);
    this.lookAtPosition.set(0, 0, -1);
    this.lookAtPosition.applyMatrix4(this.rotationMatrix);
    this.lookAtPosition.add(this.cameraWorldPosition);
    this.target.subVectors(this.reflectorWorldPosition, this.lookAtPosition);
    this.target.reflect(this.normal).negate();
    this.target.add(this.reflectorWorldPosition);
    this.virtualCamera.position.copy(this.view);
    this.virtualCamera.up.set(0, 1, 0);
    this.virtualCamera.up.applyMatrix4(this.rotationMatrix);
    this.virtualCamera.up.reflect(this.normal);
    this.virtualCamera.lookAt(this.target);
    this.virtualCamera.far = this.camera.far; // Used in WebGLBackground
    this.virtualCamera.updateMatrixWorld();
    this.virtualCamera.projectionMatrix.copy(this.camera.projectionMatrix);

    // Update the texture matrix
    this.textureMatrix.set(
      0.5,
      0.0,
      0.0,
      0.5,
      0.0,
      0.5,
      0.0,
      0.5,
      0.0,
      0.0,
      0.5,
      0.5,
      0.0,
      0.0,
      0.0,
      1.0
    );
    this.textureMatrix.multiply(this.virtualCamera.projectionMatrix);
    this.textureMatrix.multiply(this.virtualCamera.matrixWorldInverse);
    this.textureMatrix.multiply(this.parent.matrixWorld);

    // Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
    // Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
    this.reflectorPlane.setFromNormalAndCoplanarPoint(
      this.normal,
      this.reflectorWorldPosition
    );
    this.reflectorPlane.applyMatrix4(this.virtualCamera.matrixWorldInverse);
    this.clipPlane.set(
      this.reflectorPlane.normal.x,
      this.reflectorPlane.normal.y,
      this.reflectorPlane.normal.z,
      this.reflectorPlane.constant
    );
    const { projectionMatrix } = this.virtualCamera;
    this.q.x =
      (Math.sign(this.clipPlane.x) + projectionMatrix.elements[8]) /
      projectionMatrix.elements[0];
    this.q.y =
      (Math.sign(this.clipPlane.y) + projectionMatrix.elements[9]) /
      projectionMatrix.elements[5];
    this.q.z = -1.0;
    this.q.w =
      (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];
    // Calculate the scaled plane vector
    this.clipPlane.multiplyScalar(2.0 / this.clipPlane.dot(this.q));

    // Replacing the third row of the projection matrix
    projectionMatrix.elements[2] = this.clipPlane.x;
    projectionMatrix.elements[6] = this.clipPlane.y;
    projectionMatrix.elements[10] = this.clipPlane.z + 1.0;
    projectionMatrix.elements[14] = this.clipPlane.w;
  }

  update() {
    if (this.parent.material !== this) return;

    this.parent.visible = false;
    const currentXrEnabled = this.gl.xr.enabled;
    const currentShadowAutoUpdate = this.gl.shadowMap.autoUpdate;

    this.beforeRender();
    this.gl.xr.enabled = false;
    this.gl.shadowMap.autoUpdate = false;
    this.gl.setRenderTarget(this.fbo1);
    this.gl.state.buffers.depth.setMask(true);
    if (!this.gl.autoClear) this.gl.clear();

    this.onBeforeRenderReflections();

    this.gl.render(this.scene, this.virtualCamera);

    this.onAfterRenderReflections();

    if (this.hasBlur) {
      this.kawaseBlurPass.render(this.gl, this.fbo1, this.fbo2);
    }

    this.gl.xr.enabled = currentXrEnabled;
    this.gl.shadowMap.autoUpdate = currentShadowAutoUpdate;
    this.parent.visible = true;
    this.gl.setRenderTarget(null);
  }

  onBeforeRenderReflections() {}

  onAfterRenderReflections() {}

  onBeforeCompile(shader, ...args) {
    super.onBeforeCompile(shader, ...args);

    if (!shader.defines?.USE_UV) {
      shader.defines.USE_UV = "";
    }

    if (this.reflectorProps["defines-USE_BLUR"] !== undefined)
      this.defines.USE_BLUR = "";
    if (this.reflectorProps["defines-USE_DEPTH"] !== undefined)
      this.defines.USE_DEPTH = "";
    if (this.reflectorProps["defines-USE_DISTORTION"] !== undefined)
      this.defines.USE_DISTORTION = "";

    shader.defines.DISABLE_SMOOTHING = true;

    const props = this.reflectorProps;

    for (const prop in props) {
      shader.uniforms[prop] = {
        get value() {
          return props[prop];
        },
      };
    }

    shader.vertexShader = `
            uniform mat4 textureMatrix;
            varying vec4 my_vUv;     
          ${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      /* glsl */ `
          #include <project_vertex>
          my_vUv = textureMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          `
    );
    shader.fragmentShader = /* glsl */ `
            uniform sampler2D tDiffuse;
            uniform sampler2D tDiffuseBlur;
            uniform sampler2D tDepth;
            uniform sampler2D distortionMap;
            uniform float distortion;
            uniform float cameraNear;
            uniform float cameraFar;
            uniform bool hasBlur;
            uniform float mixBlur;
            uniform float mirror;
            uniform float mixStrength;
            uniform float minDepthThreshold;
            uniform float maxDepthThreshold;
            uniform float mixContrast;
            uniform float roughnessAdd;
            uniform float reflectionPower;
            uniform float envMapMixStrength;
            uniform float reflectionSaturation;
            uniform float depthScale;
            uniform float depthToBlurRatioBias;
            varying vec4 my_vUv;        
            ${shader.fragmentShader}`;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      /* glsl */ `#include <emissivemap_fragment>
        
          float distortionFactor = 0.0;
          #ifdef USE_DISTORTION
            distortionFactor = texture2D(distortionMap, vUv).r * distortion;
          #endif
    
          vec4 new_vUv = my_vUv;
          new_vUv.x += distortionFactor;
          new_vUv.y += distortionFactor;
    
          vec4 base = texture2DProj(tDiffuse, new_vUv);
          vec4 blur = texture2DProj(tDiffuseBlur, new_vUv);
          
          vec4 merge = base;
          
          #ifdef USE_NORMALMAP
            vec2 normal_uv = vec2(0.0);
            vec4 normalColor = texture2D(normalMap, vUv);
            vec3 my_normal = normalize( vec3( normalColor.r * 2.0 - 1.0, normalColor.b,  normalColor.g * 2.0 - 1.0 ) );
            vec3 coord = new_vUv.xyz / new_vUv.w;
            normal_uv = coord.xy + coord.z * my_normal.xz * 0.05 * normalScale;
            vec4 base_normal = texture2D(tDiffuse, normal_uv);
            vec4 blur_normal = texture2D(tDiffuseBlur, normal_uv);
            merge = base_normal;
            blur = blur_normal;
          #endif
    
          float depthFactor = 0.0001;
          float blurFactor = 0.0;
    
          #ifdef USE_DEPTH
            vec4 depth = texture2DProj(tDepth, new_vUv);
            depthFactor = pow(depth.r + 0.5, 4.) * 2.;
            depthFactor *= depthToBlurRatioBias;
            depthFactor = clamp(depthFactor, max(0.0001, minDepthThreshold), maxDepthThreshold);

            blurFactor += depthFactor;
    
            #ifdef USE_BLUR
              merge = merge * min(1.0, depthFactor + 0.5);
            #else
              merge = merge * depthFactor;
            #endif
          #endif
    
          float reflectorRoughnessFactor = roughness;
          #ifdef USE_ROUGHNESSMAP
            vec4 reflectorTexelRoughness = texture2D( roughnessMap, vUv );

            if(roughnessAdd != 0.) reflectorTexelRoughness.g += roughnessAdd;
            
            reflectorRoughnessFactor *= reflectorTexelRoughness.g;
          #endif

          // reflectorRoughnessFactor = pow(reflectorRoughnessFactor, 4.);
          reflectorRoughnessFactor = clamp(reflectorRoughnessFactor, 0., 1.);

          blurFactor += reflectorRoughnessFactor * mixBlur;
          blurFactor = clamp(blurFactor, 0., 1.);
          
          #ifdef USE_BLUR
            merge = mix(merge, blur, blurFactor);
          #endif
    
          vec4 newMerge = vec4(0.0, 0.0, 0.0, 1.0);
          newMerge.r = (merge.r - 0.5) * mixContrast + 0.5;
          newMerge.g = (merge.g - 0.5) * mixContrast + 0.5;
          newMerge.b = (merge.b - 0.5) * mixContrast + 0.5;

          // need to use max due to adjusting the contrast
          vec3 reflectionClr = max(vec3(0.), newMerge.rgb) * mixStrength;
          reflectionClr = LinearTosRGB(vec4(reflectionClr, 1.)).rgb;

          reflectionClr = (pow(reflectionClr, vec3(reflectionPower)) * 1.5 - 0.5) * 0.8 + 0.5;
          
          reflectionClr *= 1. - reflectorRoughnessFactor * 0.5;

          // saturate by "reflectionSaturation"
          vec3 lum = vec3(0.2126, 0.7152, 0.0722);
          vec3 gray = vec3(dot(lum, reflectionClr));
          reflectionClr = mix(reflectionClr, gray, 1. - reflectionSaturation);
          
          #ifndef ENHANCE_SHADER_LIGHTING
            // diffuseColor.rgb = vec3(blurFactor);
            diffuseColor.rgb = diffuseColor.rgb * ((1.0 - min(1.0, mirror)) + reflectionClr);
          #endif
          `
    );

    if (
      shader.defines &&
      shader.defines.ENHANCE_SHADER_LIGHTING !== undefined
    ) {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, float aoMapClr )",
          "getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, float aoMapClr, vec3 reflectionClr )"
        )
        .replace(
          "getIBLIrradiance( const in vec3 normal, float aoMapClr )",
          "getIBLIrradiance( const in vec3 normal, float aoMapClr, vec3 reflectionClr )"
        )
        .replace(
          "radiance += getIBLRadiance( geometry.viewDir, geometry.normal, pow(material.roughness, roughnessPower), aoMapClr );",
          "radiance += getIBLRadiance( geometry.viewDir, geometry.normal, pow(material.roughness, roughnessPower), aoMapClr, reflectionClr );"
        )
        .replace(
          "iblIrradiance += getIBLIrradiance( geometry.normal, aoMapClr );",
          "iblIrradiance += getIBLIrradiance( geometry.normal, aoMapClr, reflectionClr );"
        )
        .replace(
          "vec3 origEnvMapColor = vec3(envMapColor.rgb);",
          `
          vec3 origEnvMapColor =  vec3(envMapColor.rgb);
          `
        )
        .replace(
          "vec3 origEnvMapColor = vec3(envMapColor.rgb);",
          /* glsl */ `  
          envMapColor.rgb = mix(
            reflectionClr,
            envMapColor.rgb,
            min(1., roughness * envMapMixStrength)
          ) * aoMapClr;

          vec3 origEnvMapColor = vec3(envMapColor.rgb);
          `
        );
    }
  }
}

export { MeshReflectorMaterial };
