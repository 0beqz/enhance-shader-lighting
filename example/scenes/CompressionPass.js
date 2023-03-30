// from https://www.shadertoy.com/view/llfyz4
// license: https://creativecommons.org/licenses/by-nc-sa/3.0/deed.en_US (shadertoy default license)

import * as POSTPROCESSING from "postprocessing"
import * as THREE from "three"

export class CompressionPass {
	compressionPass
	compressionPass2

	constructor() {
		const SetupCompressionShader = {
			tmpVec2: new THREE.Vector2(),
			defines: {},

			uniforms: {
				tDiffuse: { value: null },
				iResolution: {
					get value() {
						return SetupCompressionShader.tmpVec2.set(window.innerWidth, window.innerHeight)
					}
				},
				intensity: {
					value: 0.5
				}
			},

			vertexShader: /* glsl */ `
        
                varying vec2 vUv;
                varying vec3 viewDir;
        
                void main() {
        
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                    viewDir = normalize( ( modelViewMatrix * vec4( position, 1.0 ) ).xyz );
        
                }
        
            `,

			fragmentShader: /* glsl */ `
                #define pi 2.*asin(1.)
        
                uniform sampler2D tDiffuse;
                uniform vec2 iResolution;
                uniform float intensity;
        
        
                vec3 toYCbCr(vec3 rgb)
                {
                    return rgb*mat3(0.299,0.587,0.114,-0.168736,-0.331264,0.5,0.5,-0.418688,-0.081312)+vec3(0,.5,.5);
                }
        
                vec3 pre( vec2 coord ){
                    return floor(256.*(toYCbCr(texture(tDiffuse, coord/iResolution.xy).xyz) - .5));
                }
        
                vec3 DCT8x8( vec2 coord, vec2 uv ) {
                    vec3 res = vec3(0);
                    for(float x = 0.; x < 8.; x++){
                        for(float y = 0.; y < 8.; y++){
                            res += pre(coord + vec2(x,y)) *
                                cos((2.*x+1.)*uv.x*pi/16.) * 
                                cos((2.*y+1.)*uv.y*pi/16.); 
                        }
                    }
                    #define a(x) (x!=0.?1.:1./sqrt(2.))
                    return res * .25 * a(uv.x) * a(uv.y);
                }
        
                void main( )
                {   
                    gl_FragColor.w = 0.;
                    vec2 uv = floor(gl_FragCoord.xy-8.*floor(gl_FragCoord.xy/8.));
                    float q = intensity *float(
                int[](
                16,  11,  10,  16,  24,  40,  51,  61,
                12,  12,  14,  19,  26,  58,  60,  55,
                14,  13,  16,  24,  40,  57,  69,  56,
                14,  17,  22,  29,  51,  87,  80,  62,
                18,  22,  37,  56,  68, 109, 103,  77,
                24,  35,  55,  64,  81, 104, 113,  92,
                49,  64,  78,  87, 103, 121, 120, 101,
                72,  92,  95,  98, 112, 100, 103,  99
                )[int(uv.x+uv.y*8.)]);
        
                gl_FragColor.xyz = (floor(.5+DCT8x8(8.*floor(gl_FragCoord.xy/8.),uv)/q))*q;
                    
                }
        
            `
		}

		const CompositeCompressionShader = {
			defines: {},

			uniforms: {
				tDiffuse: { value: null }
			},

			vertexShader: /* glsl */ `
        
                varying vec2 vUv;
                varying vec3 viewDir;
        
                void main() {
        
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                    viewDir = normalize( ( modelViewMatrix * vec4( position, 1.0 ) ).xyz );
        
                }
        
            `,

			fragmentShader: /* glsl */ `
                #define pi 2.*asin(1.)
        
                uniform sampler2D tDiffuse;
        
                vec3 toRGB(vec3 ybr)
                {
                    return (ybr-vec3(0,.5,.5))*mat3(1.,0.,1.402,1.,-.344136,-0.714136,1.,1.772,0.);
                }
        
                vec3 inp(vec2 coord){
                    return texelFetch(tDiffuse, ivec2(coord),0).xyz;
                }
        
                vec3 IDCT8x8( vec2 coord, vec2 xy ) {
                    vec3 res = vec3(0);
                    #define a(x) (x!=0.?1.:1./sqrt(2.))
                    for(float u = 0.; u < 4.; u++){
                        for(float v = 0.; v < 3.; v++){
                            res += inp(coord + vec2(u,v)) *
                                a(u) * a(v) * 
                                cos((2.*xy.x+1.)*u*pi/16.) * 
                                cos((2.*xy.y+1.)*v*pi/16.); 
                        }
                    }
                    return res * .25;
                }
        
        
                void main()
                {
                    gl_FragColor.w = 0.;
                    vec2 uv = floor(gl_FragCoord.xy-8.*floor(gl_FragCoord.xy/8.));
                    gl_FragColor.xyz = toRGB(IDCT8x8(8.*floor(gl_FragCoord.xy/8.),uv)/256.+.5);
                }
        
            `
		}

		const compressionMaterial = new THREE.ShaderMaterial()
		Object.assign(compressionMaterial, SetupCompressionShader)

		const compressionPass = new POSTPROCESSING.ShaderPass(compressionMaterial)
		const compressionPassRender = compressionPass.render
		compressionPass.render = (renderer, inputBuffer, ...args) => {
			compressionMaterial.uniforms.tDiffuse.value = inputBuffer.texture
			compressionPassRender.call(compressionPass, renderer, inputBuffer, ...args)
		}

		const compressionMaterial2 = new THREE.ShaderMaterial()
		Object.assign(compressionMaterial2, CompositeCompressionShader)

		const compressionPass2 = new POSTPROCESSING.ShaderPass(compressionMaterial2)
		const compressionPassRender2 = compressionPass2.render
		compressionPass2.render = (renderer, inputBuffer, ...args) => {
			compressionMaterial2.uniforms.tDiffuse.value = inputBuffer.texture
			compressionPassRender2.call(compressionPass2, renderer, inputBuffer, ...args)
		}

		this.compressionPass = compressionPass
		this.compressionPass2 = compressionPass2
	}

	addToComposer(composer, index) {
		composer.addPass(this.compressionPass, index - 1)
		composer.addPass(this.compressionPass2, index)
	}

	removeFromComposer(composer) {
		composer.removePass(this.compressionPass)
		composer.removePass(this.compressionPass2)
	}
}
