/**
 * Dev-only signal analysis for the audio harness: a small FFT, a dominant
 * frequency estimate, and waveform / spectrogram drawing so synthesized
 * sounds can be judged by eye in a screenshot.
 */

interface Work {
  size: number;
  hann: Float32Array;
  re: Float32Array;
  im: Float32Array;
  mag: Float32Array;
}
const work = new Map<number, Work>();

/** Scratch buffers for one FFT size (a power of two), built on first use. */
function workFor(size: number): Work {
  let w = work.get(size);
  if (!w) {
    const hann = new Float32Array(size);
    for (let i = 0; i < size; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
    w = {
      size,
      hann,
      re: new Float32Array(size),
      im: new Float32Array(size),
      mag: new Float32Array(size / 2),
    };
    work.set(size, w);
  }
  return w;
}

/** In-place iterative radix-2 FFT. */
function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = real[i]; real[i] = real[j]; real[j] = tr;
      const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const xr = real[b] * cr - imag[b] * ci;
        const xi = real[b] * ci + imag[b] * cr;
        real[b] = real[a] - xr;
        imag[b] = imag[a] - xi;
        real[a] += xr;
        imag[a] += xi;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}

/** Magnitude spectrum of a `size`-sample Hann window centred on sample `centre`. */
function spectrumAt(samples: Float32Array, centre: number, size: number): Float32Array {
  const { hann, re, im, mag } = workFor(size);
  const start = Math.round(centre) - size / 2;
  for (let i = 0; i < size; i++) {
    const s = start + i;
    re[i] = s >= 0 && s < samples.length ? samples[s] * hann[i] : 0;
    im[i] = 0;
  }
  fft(re, im);
  for (let i = 0; i < size / 2; i++) mag[i] = Math.hypot(re[i], im[i]) / (size / 4);
  return mag;
}

const PITCH_FFT = 2048;

/** Strongest frequency (Hz) around `seconds`, with parabolic interpolation. */
export function dominantHz(samples: Float32Array, sampleRate: number, seconds: number): number {
  const m = spectrumAt(samples, seconds * sampleRate, PITCH_FFT);
  const lo = Math.ceil((40 * PITCH_FFT) / sampleRate);
  let best = lo;
  for (let i = lo; i < m.length - 1; i++) if (m[i] > m[best]) best = i;
  if (m[best] < 1e-5) return 0;
  const a = m[best - 1];
  const b = m[best];
  const c = m[best + 1];
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  return ((best + shift) * sampleRate) / PITCH_FFT;
}

/** Spectral centroid (Hz) around `seconds` — the "brightness" of noisy sounds. */
export function centroidHz(samples: Float32Array, sampleRate: number, seconds: number): number {
  const m = spectrumAt(samples, seconds * sampleRate, PITCH_FFT);
  let num = 0;
  let den = 0;
  for (let i = 1; i < m.length; i++) {
    num += i * m[i];
    den += m[i];
  }
  return den > 1e-6 ? ((num / den) * sampleRate) / PITCH_FFT : 0;
}

/** Min/max waveform of `samples[0, length)` scaled so ±`scale` fills the canvas. */
export function drawWave(
  canvas: HTMLCanvasElement,
  samples: Float32Array,
  length: number,
  scale: number,
): void {
  const g = canvas.getContext("2d");
  if (!g) return;
  const { width: w, height: h } = canvas;
  g.fillStyle = "#0a0f2c";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#27358f";
  g.fillRect(0, h / 2, w, 1);
  g.fillStyle = "#ffc93c";
  const per = length / w;
  for (let x = 0; x < w; x++) {
    let lo = 0;
    let hi = 0;
    const end = Math.min(samples.length, Math.floor((x + 1) * per));
    for (let i = Math.floor(x * per); i < end; i++) {
      const v = samples[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const y1 = h / 2 - (hi / scale) * (h / 2);
    const y2 = h / 2 - (lo / scale) * (h / 2);
    g.fillRect(x, y1, 1, Math.max(1, y2 - y1));
  }
}

const SPEC_LO = 50;
const SPEC_HI = 12000;

/** Log-frequency spectrogram (50 Hz – 12 kHz, −80…−12 dB) of `samples[0, length)`. */
export function drawSpectrogram(
  canvas: HTMLCanvasElement,
  samples: Float32Array,
  length: number,
  sampleRate: number,
): void {
  const g = canvas.getContext("2d");
  if (!g) return;
  const { width: w, height: h } = canvas;
  const img = g.createImageData(w, h);
  const px = img.data;
  const ratio = Math.log(SPEC_HI / SPEC_LO);
  // Short sounds need a short window to show their shape in time; long
  // ones can afford a long window, which separates neighbouring notes.
  const seconds = length / sampleRate;
  const FFT_SIZE = seconds < 0.5 ? 1024 : seconds < 4 ? 2048 : 4096;
  for (let x = 0; x < w; x++) {
    const m = spectrumAt(samples, ((x + 0.5) / w) * length, FFT_SIZE);
    for (let y = 0; y < h; y++) {
      const f = SPEC_LO * Math.exp(ratio * (1 - y / (h - 1)));
      const bin = Math.min(m.length - 1, Math.round((f * FFT_SIZE) / sampleRate));
      const db = 20 * Math.log10(m[bin] + 1e-9);
      const t = Math.min(1, Math.max(0, (db + 80) / 68));
      // navy → royal blue → gold → cream
      const o = (y * w + x) * 4;
      if (t < 0.5) {
        const k = t * 2;
        px[o] = 10 + k * 47;
        px[o + 1] = 15 + k * 97;
        px[o + 2] = 44 + k * 191;
      } else {
        const k = (t - 0.5) * 2;
        px[o] = 57 + k * 198;
        px[o + 1] = 112 + k * 110;
        px[o + 2] = 235 - k * 150;
      }
      px[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}
