#!/usr/bin/env node
/**
 * Turns three screenshots of the /dev/og pages into every icon / social image
 * the site ships. No dependencies: Node's zlib plus macOS `sips` for resizing.
 *
 *   1. With the dev server running, screenshot the full viewport of
 *        /dev/og/card                    at 1200 x 630  -> card.png
 *        /dev/og/icon                    at  512 x 512  -> icon.png
 *        /dev/og/icon?variant=favicon    at  512 x 512  -> favicon.png
 *   2. node src/app/dev/og/build-images.mjs card.png icon.png favicon.png
 *
 * Writes (relative to the repo root, or to --out <dir> for a dry run):
 *   public/og-image.png          1200 x 630
 *   public/icon-512.png           512 x 512   (also src/app/icon.png)
 *   public/icon-192.png           192 x 192
 *   public/apple-touch-icon.png   180 x 180
 *   src/app/favicon.ico           48, 32 and 16 px frames
 *
 * The favicon frames are re-encoded as RGBA PNGs with rounded, transparent
 * corners. RGBA matters: Next's image loader refuses an .ico whose PNG frames
 * have no alpha channel, and because favicon.ico belongs to the root layout a
 * bad file fails every route.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const FAVICON_SIZES = [48, 32, 16]; // largest first: Next reports the first frame as `sizes`
const CORNER_RADIUS = 0.22; // fraction of the frame size

/* ------------------------------------------------------------------ */
/* PNG                                                                 */
/* ------------------------------------------------------------------ */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Decode an 8-bit, non-interlaced RGB or RGBA PNG into { width, height, channels, data }. */
function readPng(file) {
  const png = readFileSync(file);
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${file}: not a PNG`);
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  for (let pos = 8; pos < png.length; ) {
    const length = png.readUInt32BE(pos);
    const type = png.toString("latin1", pos + 4, pos + 8);
    const body = png.subarray(pos + 8, pos + 8 + length);
    pos += 12 + length;
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, colorType, , , interlace] = body.subarray(8);
      if (depth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
        throw new Error(`${file}: only 8-bit non-interlaced RGB/RGBA PNGs are supported`);
      }
      channels = colorType === 2 ? 3 : 4;
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? data[dst + x - channels] : 0;
      const b = y > 0 ? data[dst + x - stride] : 0;
      const c = x >= channels && y > 0 ? data[dst + x - stride - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      data[dst + x] = (raw[src + x] + predictor) & 0xff;
    }
  }
  return { width, height, channels, data };
}

function pngChunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/** Encode RGBA pixels (width * height * 4 bytes) as a PNG. */
function encodeRgbaPng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit, colour type 6 (RGBA)
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4); // filter byte stays 0
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Share of pixel (x, y) that lies inside a rounded square, by 4 x 4 supersampling. */
function cornerCoverage(x, y, size, radius) {
  let inside = 0;
  for (let sy = 0; sy < 4; sy++) {
    for (let sx = 0; sx < 4; sx++) {
      const px = x + (sx + 0.5) / 4;
      const py = y + (sy + 0.5) / 4;
      const cx = Math.min(Math.max(px, radius), size - radius);
      const cy = Math.min(Math.max(py, radius), size - radius);
      if ((px - cx) ** 2 + (py - cy) ** 2 <= radius * radius) inside++;
    }
  }
  return inside / 16;
}

/** Re-encode a square PNG as RGBA with rounded transparent corners. */
function roundedRgbaPng(file) {
  const { width, height, channels, data } = readPng(file);
  if (width !== height) throw new Error(`${file}: expected a square image`);
  const radius = CORNER_RADIUS * width;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * channels;
      const d = (y * width + x) * 4;
      rgba[d] = data[s];
      rgba[d + 1] = data[s + 1];
      rgba[d + 2] = data[s + 2];
      const alpha = channels === 4 ? data[s + 3] : 255;
      rgba[d + 3] = Math.round(alpha * cornerCoverage(x, y, width, radius));
    }
  }
  return encodeRgbaPng(width, height, rgba);
}

/* ------------------------------------------------------------------ */
/* ICO                                                                 */
/* ------------------------------------------------------------------ */

/** Pack square PNG frames ({ size, png }) into an .ico with PNG-encoded entries. */
function packIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type 1 = icon
  header.writeUInt16LE(frames.length, 4);
  let offset = 6 + 16 * frames.length;
  const entries = frames.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.set([size % 256, size % 256, 0, 0], 0); // width, height, palette, reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...frames.map((f) => f.png)]);
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function expectSize(file, width, height) {
  const png = readFileSync(file);
  const actual = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
  if (actual !== `${width}x${height}`) throw new Error(`${file} is ${actual}, expected ${width}x${height}`);
}

/** Proportional resize with macOS `sips`. */
function resize(src, size, dest) {
  execFileSync("sips", ["-Z", String(size), src, "--out", dest], { stdio: "ignore" });
}

const args = process.argv.slice(2);
const outFlag = args.indexOf("--out");
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const outRoot = outFlag >= 0 ? resolve(args.splice(outFlag, 2)[1]) : repoRoot;
const [card, icon, favicon] = args;
if (!card || !icon || !favicon) {
  console.error("usage: build-images.mjs <card.png> <icon.png> <favicon.png> [--out <dir>]");
  process.exit(2);
}
expectSize(card, 1200, 630);
expectSize(icon, 512, 512);
expectSize(favicon, 512, 512);

const publicDir = join(outRoot, "public");
const appDir = join(outRoot, "src/app");
mkdirSync(publicDir, { recursive: true });
mkdirSync(appDir, { recursive: true });

copyFileSync(card, join(publicDir, "og-image.png"));
copyFileSync(icon, join(publicDir, "icon-512.png"));
copyFileSync(icon, join(appDir, "icon.png"));
resize(icon, 192, join(publicDir, "icon-192.png"));
resize(icon, 180, join(publicDir, "apple-touch-icon.png"));

const work = mkdtempSync(join(tmpdir(), "da64-favicon-"));
const frames = FAVICON_SIZES.map((size) => {
  const scaled = join(work, `favicon-${size}.png`);
  resize(favicon, size, scaled);
  return { size, png: roundedRgbaPng(scaled) };
});
writeFileSync(join(appDir, "favicon.ico"), packIco(frames));
rmSync(work, { recursive: true, force: true }); // the scaled frames were only needed for packing

console.log(`wrote og-image, icon-512/192, apple-touch-icon, icon.png and favicon.ico (${FAVICON_SIZES.join("/")} px) under ${outRoot}`);
