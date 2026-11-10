/** STUB painting art: flat colour + title. Replaced by src/game/art/paintings.ts. */
import { DOORS, type CreateEmblemCanvas, type CreatePaintingCanvas } from "../contract";

export const createPaintingCanvas: CreatePaintingCanvas = (id, size = 128) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const spec = DOORS.find((d) => d.id === id)!;
  ctx.fillStyle = spec.accent;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (let i = 0; i < size; i += 16) ctx.fillRect(i, (i * 3) % size, 8, 8);
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${Math.round(size / 9)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(String(spec.courseNumber), size / 2, size / 2);
  ctx.fillText(spec.id, size / 2, size / 2 + size / 7);
  return canvas;
};

/** STUB emblem: gold ring + "DA". Replaced by src/game/art/emblem.ts. */
export const createEmblemCanvas: CreateEmblemCanvas = (size = 128) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.strokeStyle = "#ffc93c";
  ctx.lineWidth = size / 12;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#ffc93c";
  ctx.font = `bold ${Math.round(size * 0.4)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("DA", size / 2, size / 2);
  return canvas;
};
