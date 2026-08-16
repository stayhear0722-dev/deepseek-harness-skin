import { Geometry, Mesh, Program, Renderer, Texture, Vec2 } from 'ogl'
import { useEffect, useRef } from 'react'
import css from './HarnessAtmosphere.module.css'

const vertex = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const fragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uRunning;
uniform vec2 uPointer;
uniform vec2 uResolution;
uniform float uLogoReady;
uniform sampler2D uLogoMap;

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vUv - 0.5;
  vec2 pointer = uPointer - 0.5;
  p.x *= aspect;
  pointer.x *= aspect;

  float distanceToPointer = length(p - pointer);
  float ripple = sin(distanceToPointer * 42.0 - uTime * 4.0)
    * exp(-distanceToPointer * 7.0)
    * (1.0 - uRunning);
  p += normalize(p - pointer + 0.0001) * ripple * 0.018;

  float drift = fbm(p * 2.2 + vec2(-uTime * 0.025, uTime * 0.018));
  float ribbon = smoothstep(0.56, 0.9, drift)
    * smoothstep(0.8, 0.1, abs(p.y + sin(p.x * 1.8 + uTime * 0.11) * 0.14));
  float haze = smoothstep(0.38, 0.86, drift) * 0.62 + ribbon * 0.6;

  vec2 grid = floor((p + vec2(4.0)) * 44.0);
  vec2 cell = fract((p + vec2(4.0)) * 44.0) - 0.5;
  float starSeed = hash(grid);
  float star = step(0.9, starSeed)
    * smoothstep(0.1, 0.0, length(cell))
    * (0.6 + 0.4 * sin(uTime * 1.6 + starSeed * 20.0));

  // The exact DeepSeek fish mark is rasterized from the foreground SVG and
  // becomes a mask for this denser particle field, not a separate image layer.
  vec2 logoUv = (p - vec2(0.0, 0.15)) / vec2(0.68, 0.5) + 0.5;
  float logoBounds = step(0.0, logoUv.x) * step(logoUv.x, 1.0)
    * step(0.0, logoUv.y) * step(logoUv.y, 1.0);
  float logoMask = uLogoReady * logoBounds * smoothstep(0.06, 0.7, texture2D(uLogoMap, logoUv).a);
  float logoCore = min(
    min(texture2D(uLogoMap, logoUv + vec2(0.007, 0.0)).a, texture2D(uLogoMap, logoUv - vec2(0.007, 0.0)).a),
    min(texture2D(uLogoMap, logoUv + vec2(0.0, 0.009)).a, texture2D(uLogoMap, logoUv - vec2(0.0, 0.009)).a)
  );
  float logoOutline = logoMask * (1.0 - smoothstep(0.1, 0.7, logoCore));
  vec2 logoGrid = floor((p + vec2(4.0)) * 96.0);
  vec2 logoCell = fract((p + vec2(4.0)) * 96.0) - 0.5;
  float logoSeed = hash(logoGrid + vec2(31.0, 67.0));
  float logoParticle = logoMask
    * step(0.56, logoSeed)
    * smoothstep(0.2, 0.03, length(logoCell))
    * (0.66 + 0.34 * sin(uTime * 1.35 + logoSeed * 18.0));
  float logoContour = logoOutline
    * step(0.18, logoSeed)
    * smoothstep(0.22, 0.03, length(logoCell));
  logoParticle = max(logoParticle, logoContour * 0.9);
  float interaction = exp(-distanceToPointer * 4.8) * (1.0 - uRunning);

  vec3 base = vec3(0.004, 0.016, 0.043);
  vec3 blueHaze = vec3(0.03, 0.17, 0.35) * haze;
  vec3 cyan = vec3(0.42, 0.76, 1.0) * (star + interaction * 0.19);
  vec3 logoBlue = vec3(0.14, 0.62, 1.0) * logoParticle;
  vec3 color = base + (blueHaze + cyan + logoBlue) * mix(1.0, 0.42, uRunning);

  gl_FragColor = vec4(color, 1.0);
}
`

interface HarnessAtmosphereProps {
  readonly running: boolean
}

/**
 * A presentation-only WebGL layer for the conversation column.
 *
 * It observes only pointer position and the already-projected session running
 * state. It never participates in hit testing or changes the conversation
 * snapshot, so existing controls and extensions retain their ownership.
 */
export function HarnessAtmosphere({ running }: HarnessAtmosphereProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const runningRef = useRef(running)

  useEffect(() => {
    runningRef.current = running
  }, [running])

  useEffect(() => {
    const host = hostRef.current
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (host === null || reducedMotion || typeof window.WebGLRenderingContext === 'undefined') return

    let renderer: Renderer
    try {
      renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 1.5), antialias: false })
    } catch {
      return
    }

    const { gl } = renderer
    const pointer = new Vec2(-2, -2)
    const targetPointer = new Vec2(-2, -2)
    const resolution = new Vec2(1, 1)
    const logoTexture = new Texture(gl, {
      generateMipmaps: false,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
    })
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uRunning: { value: 0 },
        uPointer: { value: pointer },
        uResolution: { value: resolution },
        uLogoReady: { value: 0 },
        uLogoMap: { value: logoTexture },
      },
    })
    const geometry = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
      uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
    })
    const mesh = new Mesh(gl, { geometry, program })
    let frame = 0
    let disposed = false

    // Reuse the rendered official mark so the atmosphere cannot drift from
    // the brand glyph used in the HeroShell.
    const logo = host.parentElement?.querySelector<SVGSVGElement>('svg[viewBox="0 0 23.16 17.04"]')
    if (logo !== null && logo !== undefined) {
      const source = logo.cloneNode(true) as SVGSVGElement
      source.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      source.setAttribute('width', '464')
      source.setAttribute('height', '341')
      source.setAttribute('style', 'color: white')
      const image = new Image()
      image.onload = () => {
        if (disposed) return
        logoTexture.image = image
        logoTexture.needsUpdate = true
        program.uniforms.uLogoReady.value = 1
      }
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(source))}`
    }

    const resize = () => {
      const rect = host.getBoundingClientRect()
      renderer.setSize(rect.width, rect.height)
      resolution.set(renderer.width, renderer.height)
    }
    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right
        || event.clientY < rect.top || event.clientY > rect.bottom) {
        targetPointer.set(-2, -2)
        return
      }
      targetPointer.set(
        (event.clientX - rect.left) / rect.width,
        1 - (event.clientY - rect.top) / rect.height,
      )
    }
    const onPointerLeave = () => { targetPointer.set(-2, -2) }
    const render = (now: number) => {
      pointer.lerp(targetPointer, 0.075)
      program.uniforms.uTime.value = now * 0.001
      program.uniforms.uRunning.value = runningRef.current ? 1 : 0
      renderer.render({ scene: mesh })
      frame = window.requestAnimationFrame(render)
    }

    host.append(gl.canvas)
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    host.addEventListener('pointerleave', onPointerLeave)
    frame = window.requestAnimationFrame(render)

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerleave', onPointerLeave)
      program.remove()
      geometry.remove()
      gl.deleteTexture(logoTexture.texture)
      gl.canvas.remove()
    }
  }, [])

  return <div ref={hostRef} className={css.atmosphere} aria-hidden="true" />
}
