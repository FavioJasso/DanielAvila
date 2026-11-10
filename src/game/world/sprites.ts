/**
 * Sprite effects, each a single draw call animated in its vertex shader:
 *  - flames:   camera-facing cut-out quads flipping through a 4-frame sheet
 *  - glows:    soft colour washes fixed on the walls (torch light, the halo
 *              round each painting, the shine behind the door stars). They
 *              are alpha-blended rather than additive, so they still read on
 *              the room's bright cream plaster.
 *  - sparkles: camera-facing pixel twinkles round the pedestal star, plus
 *              the burst particles for `starBurst()`
 */
import * as THREE from "three";
import type { TorchSpot } from "./plan";
import { toLinear, type RGB, type V3 } from "./util";

const COLORSPACE = "#include <colorspace_fragment>";

/* ------------------------------------------------------------------ */
/* Flames                                                              */
/* ------------------------------------------------------------------ */

const FLAME_VERT = /* glsl */ `
uniform float uTime;
attribute vec2 aCorner;   // x: -0.5..0.5, y: 0 (base) .. 1 (tip)
attribute vec3 aParams;   // width, height, phase
varying vec2 vUv;
void main() {
  float phase = aParams.z;
  float frame = mod(floor(uTime * 9.0 + phase * 4.0), 4.0);
  vec2 cell = vec2(mod(frame, 2.0), floor(frame * 0.5));
  // stay a hair inside the cell so nearest sampling never bleeds a neighbour
  vUv = (cell + 0.02 + vec2(aCorner.x + 0.5, aCorner.y) * 0.96) * 0.5;
  float wob = 1.0 + 0.09 * sin(uTime * 13.0 + phase * 6.2832);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.x += aCorner.x * aParams.x * (2.0 - wob);
  mv.y += aCorner.y * aParams.y * wob;
  gl_Position = projectionMatrix * mv;
}`;

const FLAME_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D(uMap, vUv);
  if (texel.a < 0.5) discard;
  gl_FragColor = vec4(texel.rgb, 1.0);
  ${COLORSPACE}
}`;

export interface Flames {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
}

export function createFlames(torches: readonly TorchSpot[], map: THREE.Texture): Flames {
  const n = torches.length;
  const pos = new Float32Array(n * 12);
  const corner = new Float32Array(n * 8);
  const params = new Float32Array(n * 12);
  const index: number[] = [];
  const corners = [-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 1];
  torches.forEach((t, i) => {
    for (let v = 0; v < 4; v++) {
      pos.set([t.x, t.y - 0.03, t.z], i * 12 + v * 3);
      corner.set([corners[v * 2], corners[v * 2 + 1]], i * 8 + v * 2);
      params.set([0.4 * t.size, 0.62 * t.size, (i * 0.618) % 1], i * 12 + v * 3);
    }
    index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aCorner", new THREE.BufferAttribute(corner, 2));
  geo.setAttribute("aParams", new THREE.BufferAttribute(params, 3));
  geo.setIndex(index);
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMap: { value: map } },
    vertexShader: FLAME_VERT,
    fragmentShader: FLAME_FRAG,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = "flames";
  mesh.frustumCulled = false; // the quads are expanded in the shader
  return { mesh, material };
}

/* ------------------------------------------------------------------ */
/* Glows                                                               */
/* ------------------------------------------------------------------ */

const GLOW_VERT = /* glsl */ `
uniform float uTime;
uniform float uDoor[5];
attribute vec3 aColor;
attribute vec3 aAnim;     // x: door index or -1, y: flicker phase or -1, z: opacity
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vRect;
void main() {
  float k = aAnim.z;
  vRect = 0.0;
  if (aAnim.x >= 0.0) {
    k *= uDoor[int(aAnim.x + 0.5)];
    vRect = 1.0; // painting halos use the rounded-rectangle mask
  }
  if (aAnim.y >= 0.0) {
    k *= 0.8 + 0.2 * sin(uTime * 11.0 + aAnim.y * 6.2832) * sin(uTime * 7.3 + aAnim.y * 11.0);
  }
  vColor = aColor;
  vAlpha = k;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const GLOW_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vRect;
void main() {
  vec4 m = texture2D(uMap, vUv);
  gl_FragColor = vec4(vColor, clamp(mix(m.r, m.g, vRect) * vAlpha, 0.0, 1.0));
  ${COLORSPACE}
}`;

export interface GlowQuad {
  center: V3;
  /** Unit vectors spanning the quad. */
  right: V3;
  up: V3;
  width: number;
  height: number;
  /** Display-space colour the wall behind is washed towards. */
  color: RGB;
  /** Opacity at the centre of the glow (before the door level / flicker). */
  opacity: number;
  /** Door whose `uDoor` level scales this quad, or -1. */
  door: number;
  /** 0..1 flicker phase, or -1 for a steady glow. */
  flicker: number;
}

export interface Glows {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  /** Per-door level (painting halo); written by the door each frame. */
  door: Float32Array;
}

export function createGlows(quads: readonly GlowQuad[], map: THREE.Texture): Glows {
  const n = quads.length;
  const pos = new Float32Array(n * 12);
  const uv = new Float32Array(n * 8);
  const color = new Float32Array(n * 12);
  const anim = new Float32Array(n * 12);
  const index: number[] = [];
  const corners = [-1, -1, 1, -1, 1, 1, -1, 1];
  quads.forEach((q, i) => {
    for (let v = 0; v < 4; v++) {
      const cx = corners[v * 2] * q.width * 0.5;
      const cy = corners[v * 2 + 1] * q.height * 0.5;
      pos.set(
        [
          q.center[0] + q.right[0] * cx + q.up[0] * cy,
          q.center[1] + q.right[1] * cx + q.up[1] * cy,
          q.center[2] + q.right[2] * cx + q.up[2] * cy,
        ],
        i * 12 + v * 3,
      );
      uv.set([corners[v * 2] * 0.5 + 0.5, corners[v * 2 + 1] * 0.5 + 0.5], i * 8 + v * 2);
      color.set([toLinear(q.color[0]), toLinear(q.color[1]), toLinear(q.color[2])], i * 12 + v * 3);
      anim.set([q.door, q.flicker, q.opacity], i * 12 + v * 3);
    }
    index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  geo.setAttribute("aAnim", new THREE.BufferAttribute(anim, 3));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  const door = new Float32Array(5);
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMap: { value: map }, uDoor: { value: door } },
    vertexShader: GLOW_VERT,
    fragmentShader: GLOW_FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = "glows";
  mesh.renderOrder = 2;
  return { mesh, material, door };
}

/* ------------------------------------------------------------------ */
/* Sparkles                                                            */
/* ------------------------------------------------------------------ */

const SPARKLE_VERT = /* glsl */ `
attribute vec2 aCorner;   // -0.5..0.5
attribute vec2 aSA;       // size (world units), alpha
varying vec2 vUv;
varying float vAlpha;
void main() {
  vUv = aCorner + 0.5;
  vAlpha = aSA.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.xy += aCorner * aSA.x;
  gl_Position = projectionMatrix * mv;
}`;

const SPARKLE_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying float vAlpha;
void main() {
  vec4 texel = texture2D(uMap, vUv);
  if (texel.a < 0.5) discard;
  gl_FragColor = vec4(texel.rgb, vAlpha);
  ${COLORSPACE}
}`;

const GRAVITY = -3.2;
const BURST_LIFE = 0.95;

export interface Sparkles {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  burst(): void;
  update(dt: number, time: number): void;
}

/**
 * `twinkles` slow orbiting glints plus `burstCount` particles that fly out
 * when `burst()` is called. Everything lives in preallocated typed arrays;
 * `update` only writes into them.
 */
export function createSparkles(
  center: V3,
  map: THREE.Texture,
  twinkles: number,
  burstCount: number,
  reducedMotion: boolean,
): Sparkles {
  const n = twinkles + burstCount;
  const pos = new Float32Array(n * 12);
  const corner = new Float32Array(n * 8);
  const sa = new Float32Array(n * 8);
  const index: number[] = [];
  const corners = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5];
  for (let i = 0; i < n; i++) {
    for (let v = 0; v < 4; v++) corner.set([corners[v * 2], corners[v * 2 + 1]], i * 8 + v * 2);
    index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  const saAttr = new THREE.BufferAttribute(sa, 2);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  saAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("position", posAttr);
  geo.setAttribute("aCorner", new THREE.BufferAttribute(corner, 2));
  geo.setAttribute("aSA", saAttr);
  geo.setIndex(index);
  const material = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map } },
    vertexShader: SPARKLE_VERT,
    fragmentShader: SPARKLE_FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = "sparkles";
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;

  // burst particle state: position, velocity, age (>= BURST_LIFE = idle)
  const bp = new Float32Array(burstCount * 3);
  const bv = new Float32Array(burstCount * 3);
  const age = new Float32Array(burstCount).fill(BURST_LIFE);

  const write = (i: number, x: number, y: number, z: number, size: number, alpha: number) => {
    const p = i * 12;
    const s = i * 8;
    for (let v = 0; v < 4; v++) {
      pos[p + v * 3] = x;
      pos[p + v * 3 + 1] = y;
      pos[p + v * 3 + 2] = z;
      sa[s + v * 2] = size;
      sa[s + v * 2 + 1] = alpha;
    }
  };

  return {
    mesh,
    material,
    burst() {
      for (let i = 0; i < burstCount; i++) {
        // evenly spread directions (golden-angle spiral), biased upward
        const k = (i + 0.5) / burstCount;
        const elev = Math.asin(1 - 1.5 * k);
        const az = i * 2.39996;
        const speed = (reducedMotion ? 1.3 : 2.9) * (0.75 + 0.5 * (((i * 7) % 5) / 4));
        bp[i * 3] = center[0];
        bp[i * 3 + 1] = center[1];
        bp[i * 3 + 2] = center[2];
        bv[i * 3] = Math.cos(elev) * Math.cos(az) * speed;
        bv[i * 3 + 1] = Math.sin(elev) * speed + 1.4;
        bv[i * 3 + 2] = Math.cos(elev) * Math.sin(az) * speed;
        age[i] = 0;
      }
    },
    update(dt, time) {
      for (let i = 0; i < twinkles; i++) {
        const a = time * (0.5 + 0.07 * i) + i * 2.1;
        const r = 0.78 + 0.16 * Math.sin(time * 0.9 + i * 1.3);
        const tw = Math.sin(time * 2.6 + i * 1.9);
        const size = 0.34 * Math.max(0, tw) * Math.max(0, tw);
        write(
          i,
          center[0] + Math.cos(a) * r,
          center[1] + 0.34 * Math.sin(time * 0.7 + i * 2.4),
          center[2] + Math.sin(a) * r,
          size,
          1,
        );
      }
      for (let i = 0; i < burstCount; i++) {
        const slot = twinkles + i;
        if (age[i] >= BURST_LIFE) {
          write(slot, center[0], center[1], center[2], 0, 0);
          continue;
        }
        age[i] += dt;
        bv[i * 3 + 1] += GRAVITY * dt;
        bp[i * 3] += bv[i * 3] * dt;
        bp[i * 3 + 1] += bv[i * 3 + 1] * dt;
        bp[i * 3 + 2] += bv[i * 3 + 2] * dt;
        const k = Math.min(1, age[i] / BURST_LIFE);
        write(slot, bp[i * 3], bp[i * 3 + 1], bp[i * 3 + 2], 0.42 * (1 - k * 0.6), 1 - k * k);
      }
      posAttr.needsUpdate = true;
      saAttr.needsUpdate = true;
    },
  };
}
