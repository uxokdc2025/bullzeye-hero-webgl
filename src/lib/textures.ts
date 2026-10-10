/**
 * textures.ts — procedurally generated textures (canvas-based), so the POC
 * is fully self-contained: no network HDRI/texture fetches, deterministic,
 * works offline and in headless browsers.
 */
import * as THREE from "three";

/** Dark, photographic grass: color + a matching normal map for micro relief. */
export function makeGrassTextures(size = 512): {
  color: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  rough: THREE.CanvasTexture;
} {
  const color = document.createElement("canvas");
  const normal = document.createElement("canvas");
  const rough = document.createElement("canvas");
  color.width = color.height = size;
  normal.width = normal.height = size;
  rough.width = rough.height = size;

  const cctx = color.getContext("2d")!;
  const nctx = normal.getContext("2d")!;
  const rctx = rough.getContext("2d")!;

  // base green (albedo; material color stays white so this defines the hue)
  cctx.fillStyle = "#39683f";
  cctx.fillRect(0, 0, size, size);
  nctx.fillStyle = "#8080ff"; // flat normal
  nctx.fillRect(0, 0, size, size);
  rctx.fillStyle = "#b8b8b8";
  rctx.fillRect(0, 0, size, size);

  // short grass blades as tiny strokes, varied green
  const blades = 26000;
  for (let i = 0; i < blades; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 2 + Math.random() * 5;
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;

    const g = 70 + Math.random() * 95;
    const r = 34 + Math.random() * 52;
    const b = 34 + Math.random() * 44;
    cctx.strokeStyle = `rgb(${r},${g},${b})`;
    cctx.lineWidth = 0.7 + Math.random() * 0.8;
    cctx.beginPath();
    cctx.moveTo(x, y);
    cctx.lineTo(x + dx, y + dy);
    cctx.stroke();

    // normal perturbation: lean the blade's normal
    const nr = 128 + Math.cos(ang) * 60;
    const ng = 128 + Math.sin(ang) * 60;
    nctx.strokeStyle = `rgb(${nr | 0},${ng | 0},255)`;
    nctx.lineWidth = 1.0;
    nctx.beginPath();
    nctx.moveTo(x, y);
    nctx.lineTo(x + dx, y + dy);
    nctx.stroke();

    // roughness speckle
    const rv = 150 + Math.random() * 90;
    rctx.strokeStyle = `rgb(${rv | 0},${rv | 0},${rv | 0})`;
    rctx.lineWidth = 0.8;
    rctx.beginPath();
    rctx.moveTo(x, y);
    rctx.lineTo(x + dx, y + dy);
    rctx.stroke();
  }

  const mk = (c: HTMLCanvasElement, srgb = false) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 10);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };

  return { color: mk(color, true), normal: mk(normal), rough: mk(rough) };
}

/** Golf-ball dimple normal map (hex-packed depressions). */
export function makeDimpleNormal(size = 512): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);

  const cols = 26;
  const r = size / cols / 2;
  for (let row = 0; row < cols + 1; row++) {
    for (let col = 0; col < cols + 1; col++) {
      const offset = row % 2 === 0 ? 0 : r;
      const cx = col * (size / cols) + offset;
      const cy = row * (size / cols) * 0.9;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.95);
      // fake a concave dimple: normals push inward
      grad.addColorStop(0, "rgba(128,128,255,1)");
      grad.addColorStop(0.55, "rgba(128,128,255,1)");
      grad.addColorStop(0.8, "rgba(150,106,235,1)");
      grad.addColorStop(1, "rgba(106,150,235,1)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}
