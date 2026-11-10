/**
 * Daniel 64 — world-space effects: the blob shadow and a pooled particle
 * batch (dust puffs, floating "Z"s, sparkles).
 *
 * All particles share one mesh, one material and one 64×64 atlas, so the
 * whole lot costs a single draw call. Quads are billboarded in the vertex
 * shader; the CPU only rewrites two small attribute arrays per frame and
 * never allocates.
 */
import * as THREE from "three";
import { FX_CELL } from "./textures";

/* ------------------------------------------------------------------ */
/* Blob shadow                                                         */
/* ------------------------------------------------------------------ */

const SHADOW_RADIUS = 0.46;
const SHADOW_SEGMENTS = 12;
const SHADOW_OPACITY = 0.42;
/**
 * Just above the floor and everything laid on it: the world's carpet sits at
 * 0.024, door thresholds at 0.03 and the "DA" emblem decal at the spawn point
 * at 0.036, so the shadow must clear all of them or it vanishes under the
 * emblem exactly where the game starts.
 */
const SHADOW_Y = 0.05;

export interface BlobShadow {
  mesh: THREE.Mesh;
  /** `height`: how far the avatar's feet are above the floor. */
  set(x: number, z: number, height: number, spread: number): void;
  dispose(): void;
}

export function createShadow(): BlobShadow {
  // A disc with a solid core and a rim that fades to nothing (vertex alpha),
  // which reads as a soft round shadow without a texture.
  const pos: number[] = [0, 0, 0];
  const col: number[] = [0, 0, 0, 1];
  for (const [r, a] of [
    [0.55, 1],
    [1, 0],
  ]) {
    for (let i = 0; i < SHADOW_SEGMENTS; i++) {
      const t = (i / SHADOW_SEGMENTS) * Math.PI * 2;
      pos.push(Math.sin(t) * r * SHADOW_RADIUS, 0, Math.cos(t) * r * SHADOW_RADIUS);
      col.push(0, 0, 0, a);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < SHADOW_SEGMENTS; i++) {
    const j = (i + 1) % SHADOW_SEGMENTS;
    const a = 1 + i;
    const b = 1 + j;
    const c = 1 + SHADOW_SEGMENTS + i;
    const d = 1 + SHADOW_SEGMENTS + j;
    idx.push(0, a, b, a, c, d, a, d, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  geometry.setIndex(idx);

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: SHADOW_OPACITY,
    depthWrite: false,
    polygonOffset: true,
    // stronger than the world's floor decals (-4) so it always wins the tie
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "avatar-shadow";
  mesh.renderOrder = 1;
  mesh.position.y = SHADOW_Y;

  return {
    mesh,
    set(x, z, height, spread) {
      // shrink and fade with height, never quite disappearing
      const h = height < 0 ? 0 : height > 4 ? 1 : height / 4;
      const k = (1 - 0.55 * h) * spread;
      mesh.position.set(x, SHADOW_Y, z);
      mesh.scale.set(k, 1, k);
      material.opacity = SHADOW_OPACITY * (1 - 0.7 * h);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Particle batch                                                      */
/* ------------------------------------------------------------------ */

const VERT = /* glsl */ `
attribute vec2 aCorner;
attribute vec4 aParams; // size, rotation, alpha, atlas cell
varying vec2 vUv;
varying float vAlpha;
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float c = cos(aParams.y);
  float s = sin(aParams.y);
  mvPosition.xy += vec2(aCorner.x * c - aCorner.y * s, aCorner.x * s + aCorner.y * c) * aParams.x;
  gl_Position = projectionMatrix * mvPosition;
  // 2×2 atlas, cell 0 is the top-left of the canvas
  vec2 cell = vec2(mod(aParams.w, 2.0), 1.0 - floor(aParams.w * 0.5));
  vUv = (cell + aCorner + 0.5) * 0.5;
  vAlpha = aParams.z;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
  vec4 texel = texture2D(map, vUv);
  if (texel.a < 0.5) discard;
  gl_FragColor = vec4(texel.rgb, vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** Per-particle state, as parallel typed arrays (stride-free, no objects). */
const FIELDS = [
  "x",
  "y",
  "z",
  "vx",
  "vy",
  "vz",
  "age",
  "life",
  "size0",
  "size1",
  "rot",
  "spin",
  "cell",
  "alpha",
  "fadeIn",
  "fadeOut",
  "drag",
  "wobble",
  "wx",
  "wz",
] as const;
type Field = (typeof FIELDS)[number];
/** Everything a caller sets at spawn time (all fields but the running age). */
const SPEC_FIELDS = FIELDS.filter((f): f is Exclude<Field, "age"> => f !== "age");

/**
 * Spawn parameters. `cell` picks the atlas image; `life` is in seconds;
 * `size0` → `size1` is the world-space size from birth to death; `spin` is in
 * radians per second; `fadeIn` / `fadeOut` are fractions of the lifetime;
 * `drag` damps the velocity per second; `wobble` is a sideways sway (world
 * units) along the ground direction (`wx`, `wz`).
 */
export type ParticleSpec = Record<Exclude<Field, "age">, number>;

export interface Particles {
  mesh: THREE.Mesh;
  /** Reusable spec: fill it in, then call `spawn()`. */
  readonly spec: ParticleSpec;
  spawn(): void;
  /** Cut the remaining life of every particle of this cell type to `seconds`. */
  hurry(cell: number, seconds: number): void;
  update(dt: number): void;
  readonly alive: number;
  dispose(): void;
}

export function createParticles(atlas: THREE.Texture, capacity: number): Particles {
  const data = {} as Record<Field, Float32Array>;
  for (const f of FIELDS) data[f] = new Float32Array(capacity);
  let count = 0;

  // four vertices per particle; `position` holds the particle centre
  const centres = new Float32Array(capacity * 4 * 3);
  const params = new Float32Array(capacity * 4 * 4);
  const corners = new Float32Array(capacity * 4 * 2);
  const index = new Uint16Array(capacity * 6);
  const quad = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5];
  for (let i = 0; i < capacity; i++) {
    corners.set(quad, i * 8);
    const v = i * 4;
    index.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
  }
  const geometry = new THREE.BufferGeometry();
  const centreAttr = new THREE.BufferAttribute(centres, 3).setUsage(THREE.DynamicDrawUsage);
  const paramAttr = new THREE.BufferAttribute(params, 4).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", centreAttr);
  geometry.setAttribute("aParams", paramAttr);
  geometry.setAttribute("aCorner", new THREE.BufferAttribute(corners, 2));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.setDrawRange(0, 0);

  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null } }]),
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  material.uniforms.map.value = atlas;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "avatar-particles";
  mesh.frustumCulled = false; // the quads live anywhere in the room
  mesh.renderOrder = 2;
  mesh.visible = false;

  const spec: ParticleSpec = {
    cell: FX_CELL.dust,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 1,
    size0: 0.2,
    size1: 0.2,
    rot: 0,
    spin: 0,
    alpha: 1,
    fadeIn: 0,
    fadeOut: 0.5,
    drag: 0,
    wobble: 0,
    wx: 1,
    wz: 0,
  };

  return {
    mesh,
    spec,
    get alive() {
      return count;
    },
    spawn() {
      // when the pool is full the oldest-slot particle is recycled
      const i = count < capacity ? count++ : 0;
      data.age[i] = 0;
      for (let f = 0; f < SPEC_FIELDS.length; f++) {
        const name = SPEC_FIELDS[f];
        data[name][i] = spec[name];
      }
    },
    hurry(cell, seconds) {
      for (let i = 0; i < count; i++) {
        if (data.cell[i] !== cell) continue;
        const left = data.life[i] - data.age[i];
        if (left > seconds) {
          // keep the fade-out proportional to the shortened life
          data.life[i] = data.age[i] + seconds;
          data.fadeOut[i] = Math.min(1, seconds / data.life[i]);
        }
      }
    },
    update(dt) {
      let i = 0;
      while (i < count) {
        data.age[i] += dt;
        if (data.age[i] >= data.life[i]) {
          // swap-remove
          count--;
          for (let f = 0; f < FIELDS.length; f++) {
            const a = data[FIELDS[f]];
            a[i] = a[count];
          }
          continue;
        }
        const damp = Math.max(0, 1 - data.drag[i] * dt);
        data.vx[i] *= damp;
        data.vy[i] *= damp;
        data.vz[i] *= damp;
        data.x[i] += data.vx[i] * dt;
        data.y[i] += data.vy[i] * dt;
        data.z[i] += data.vz[i] * dt;
        data.rot[i] += data.spin[i] * dt;

        const u = data.age[i] / data.life[i];
        const sway = data.wobble[i] * Math.sin(data.age[i] * 3.2);
        const px = data.x[i] + sway * data.wx[i];
        const py = data.y[i];
        const pz = data.z[i] + sway * data.wz[i];
        const size = data.size0[i] + (data.size1[i] - data.size0[i]) * u;
        let alpha = data.alpha[i];
        if (u < data.fadeIn[i]) alpha *= u / data.fadeIn[i];
        else if (u > 1 - data.fadeOut[i]) alpha *= (1 - u) / data.fadeOut[i];

        for (let v = 0; v < 4; v++) {
          const c = (i * 4 + v) * 3;
          centres[c] = px;
          centres[c + 1] = py;
          centres[c + 2] = pz;
          const q = (i * 4 + v) * 4;
          params[q] = size;
          params[q + 1] = data.rot[i];
          params[q + 2] = alpha;
          params[q + 3] = data.cell[i];
        }
        i++;
      }
      mesh.visible = count > 0;
      geometry.setDrawRange(0, count * 6);
      if (count > 0) {
        centreAttr.needsUpdate = true;
        paramAttr.needsUpdate = true;
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
