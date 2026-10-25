import { useEffect, useMemo } from 'react'
import { DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshStandardMaterial, RepeatWrapping, RGBAFormat } from 'three'
import { randomSource } from './natural-geometry'
import type { Texture } from 'three'

/** Object-space mineral/soil grain, no textures or extra render passes. */
export function SurfaceMaterial({ color = '#ffffff', vertexColors = false, grain = 0.08, finish = 'stone', relief = vertexColors, worldSpace = false, map }: { color?: string; vertexColors?: boolean; grain?: number; finish?: 'stone' | 'wood' | 'water'; relief?: boolean; worldSpace?: boolean; map?: Texture }) {
  const material = useMemo(() => {
    // Generated once per material, sampled with mipmaps instead of expensive
    // per-fragment trigonometric noise. No asset downloads or texture popping.
    const random = randomSource(651), data = new Uint8Array(128 * 128 * 4)
    for (let i = 0; i < data.length; i += 4) {
      const value = Math.floor(random() * 255)
      data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255
    }
    const noise = new DataTexture(data, 128, 128, RGBAFormat)
    noise.wrapS = noise.wrapT = RepeatWrapping
    noise.magFilter = LinearFilter; noise.minFilter = LinearMipmapLinearFilter
    noise.generateMipmaps = true; noise.needsUpdate = true
    const m = new MeshStandardMaterial({ color, vertexColors, map, roughness: finish === 'water' ? 0.28 : 0.96, metalness: finish === 'water' ? 0.15 : 0 })
    m.userData.noise = noise
    m.onBeforeCompile = shader => {
      shader.uniforms.surfaceNoise = { value: noise }
      shader.vertexShader = 'varying vec3 vSurface;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vSurface = position;
        ${worldSpace ? '#ifdef USE_INSTANCING\nvSurface = (instanceMatrix * vec4(position, 1.0)).xyz;\n#endif' : ''}
      `)
      shader.fragmentShader = `varying vec3 vSurface;
        uniform sampler2D surfaceNoise;
        float noiseSurface(vec3 p) {
          return texture2D(surfaceNoise, (p.xz + p.y * vec2(0.37, 0.71)) / 128.0).r;
        }\n` + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float broad = (noiseSurface(vSurface * ${finish === 'wood' ? 'vec3(22.0, 0.6, 22.0)' : '1.8'}) - 0.5) * 2.0;
        float fine = (noiseSurface(vSurface * 85.0) - 0.5) * 2.0;
        float attenuation = 1.0 / (1.0 + length(fwidth(vSurface)) * 80.0);
        diffuseColor.rgb *= 1.0 + ${grain.toFixed(4)} * (broad + fine * attenuation * 0.6);`)
      if (relief || finish === 'water') shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float relief = ${finish === 'water' ? 'sin(vSurface.x * 85.0 + sin(vSurface.z * 31.0)) * 0.0006' : 'noiseSurface(vSurface * 32.0) * 0.012'};
        vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
        vec3 r0 = cross(q1, normal), r1 = cross(normal, q0);
        float determinant = dot(q0, r0);
        vec3 gradient = sign(determinant) * (dFdx(relief) * r0 + dFdy(relief) * r1);
        normal = normalize(abs(determinant) * normal - gradient);
      `)
    }
    m.customProgramCacheKey = () => `surface-${grain}-${finish}-${relief}-${worldSpace}`
    return m
  }, [color, vertexColors, grain, finish, relief, worldSpace, map])
  useEffect(() => () => { material.userData.noise.dispose(); material.dispose() }, [material])
  return <primitive object={material} attach="material" />
}
