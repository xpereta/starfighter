import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { SpectacleQuality } from '../../../data/spectacle-quality';
import type { PostDef } from '../spectacle-contract';
import { createPostState, type PostFrame, type PostState } from './post-state';
import { spectacleSettings } from './settings';

/**
 * The finishing pass: colour fringe that grows towards the edges (and pulses on hits), vignette,
 * scanlines, film grain and a zoom punch of the finished picture. Runs in linear colour before the
 * output pass, so the colours match the plain render.
 */
const FinishShader = {
  name: 'SpectacleFinish',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uChroma: { value: 0 },
    uVignette: { value: 0 },
    uGrain: { value: 0 },
    uScan: { value: 0 },
    uZoom: { value: 0 },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uChroma, uVignette, uGrain, uScan, uZoom, uTime;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = 0.5 + (vUv - 0.5) / (1.0 + uZoom);
      vec2 d = uv - 0.5;
      vec2 off = d * uChroma * (0.002 + dot(d, d) * 0.05);
      vec3 col = vec3(
        texture2D(tDiffuse, uv + off).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - off).b);
      float v = smoothstep(0.28, 0.85, length((vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0)));
      col *= 1.0 - uVignette * v;
      col *= 1.0 - uScan * 0.3 * step(1.0, mod(floor(vUv.y * uRes.y), 2.0));
      col += (hash(vUv * uRes + fract(uTime) * 91.0) - 0.5) * uGrain * 0.1;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export interface Post {
  /** True when the composer exists and has not failed. */
  readonly working: boolean;
  /** A player hit or a big kill: starts the colour-fringe pulse. */
  hit(amount: number): void;
  /** A big kill: starts the zoom punch. */
  punch(amount: number): void;
  /**
   * Draws the scene through the passes and returns true, or returns false when the plain render
   * should be used instead (post off, nothing to apply, or a failure).
   */
  render(dt: number, time: number, def: PostDef): boolean;
  resize(width: number, height: number): void;
  dispose(): void;
}

/** Builds the composer, or returns null where it cannot work (no float render targets, errors). */
export function createPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  quality: SpectacleQuality,
): Post | null {
  try {
    const floats =
      renderer.extensions.has('EXT_color_buffer_float') ||
      renderer.extensions.has('EXT_color_buffer_half_float');
    if (!renderer.capabilities.isWebGL2 || !floats) return null;

    const composer = new EffectComposer(renderer);
    composer.renderTarget1.samples = quality.msaa;
    composer.renderTarget2.samples = quality.msaa;
    composer.addPass(new RenderPass(scene, camera));
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.x * quality.bloomScale, size.y * quality.bloomScale),
      0,
      0,
      1,
    );
    composer.addPass(bloom);
    const finish = new ShaderPass(FinishShader);
    composer.addPass(finish);
    composer.addPass(new OutputPass());

    const state: PostState = createPostState();
    let failed = false;
    const u = finish.uniforms as typeof FinishShader.uniforms;

    const applySize = (): void => {
      const s = renderer.getDrawingBufferSize(new THREE.Vector2());
      bloom.setSize(Math.max(2, s.x * quality.bloomScale), Math.max(2, s.y * quality.bloomScale));
      u.uRes.value.set(s.x, s.y);
    };
    applySize();

    return {
      get working() {
        return !failed;
      },
      hit: (a) => state.hit(a),
      punch: (a) => state.punch(a),
      render(dt, time, def) {
        const on = !failed && spectacleSettings.post;
        const f: PostFrame = state.step(dt, def, on, spectacleSettings.intensity);
        const glow = on && spectacleSettings.bloom && def.bloom.strength > 0;
        if (!on || (f.neutral && !glow)) return false;
        bloom.enabled = glow;
        if (glow) {
          bloom.strength = def.bloom.strength;
          bloom.radius = def.bloom.radius;
          bloom.threshold = def.bloom.threshold;
        }
        u.uChroma.value = f.chroma;
        u.uVignette.value = f.vignette;
        u.uGrain.value = f.grain;
        u.uScan.value = f.scanlines;
        u.uZoom.value = f.zoom;
        u.uTime.value = time;
        try {
          composer.render(dt);
          return true;
        } catch (err) {
          failed = true;
          console.warn('post-processing failed, using the plain render', err);
          return false;
        }
      },
      resize(width, height) {
        composer.setSize(width, height);
        applySize();
      },
      dispose() {
        composer.dispose();
        bloom.dispose();
        finish.dispose();
      },
    };
  } catch (err) {
    console.warn('post-processing is not available, using the plain render', err);
    return null;
  }
}
