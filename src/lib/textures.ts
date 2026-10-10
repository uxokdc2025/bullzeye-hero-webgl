/**
 * textures.ts — procedurally generated textures (canvas-based), so the POC
 * is fully self-contained: no network texture fetches, deterministic look,
 * works offline and in headless browsers.
 *
 * The grass is authored at high resolution with a multi-tone albedo, a
 * low-frequency macro variation (to kill the obvious tiling grid), mowing
 * stripes, a matching micro-normal map, a roughness map and an AO map.
 */
import * as THREE from "three";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export interface GrassTextures {
  color: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  rough: THREE.CanvasTexture;
  ao: THREE.CanvasTexture;
}

/** Photoreal dark-turf grass: albedo + normal + roughness + AO. */
export function makeGrassTextures(size = 1024, tone = "#45733f"): GrassTextures {
  const [br, bg, bb] = hexToRgb(tone);

  const color = document.createElement("canvas");
  const normal = document.createElement("canvas");
  const rough = document.createElement("canvas");
  const ao = document.createElement("canvas");
  for (const c of [color, normal, rough, ao]) {
    c.width = c.height = size;
  }

  const cctx = color.getContext("2d")!;
  const nctx = normal.getContext("2d")!;
  const rctx = rough.getContext("2d")!;
  const actx = ao.getContext("2d")!;

  // --- base fills -----------------------------------------------------------
  cctx.fillStyle = `rgb(${br},${bg},${bb})`;
  cctx.fillRect(0, 0, size, size);
  nctx.fillStyle = "#8080ff"; // flat normal
  nctx.fillRect(0, 0, size, size);
  rctx.fillStyle = "#c2c2c2"; // fairly rough turf
  rctx.fillRect(0, 0, size, size);
  actx.fillStyle = "#ffffff"; // no occlusion by default
  actx.fillRect(0, 0, size, size);

  // --- low-frequency MACRO variation (kills the tiling grid) ---------------
  // large, soft, overlapping tone blobs so no two regions of the tile look
  // identical; these read as natural patchiness rather than a repeated cell.
  cctx.globalCompositeOperation = "overlay";
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = size * (0.18 + Math.random() * 0.3);
    const light = Math.random() > 0.5;
    const a = 0.12 + Math.random() * 0.16;
    const grad = cctx.createRadialGradient(x, y, 0, x, y, r);
    const v = light ? 210 : 40;
    grad.addColorStop(0, `rgba(${v},${v},${v},${a})`);
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
    cctx.fillStyle = grad;
    cctx.beginPath();
    cctx.arc(x, y, r, 0, Math.PI * 2);
    cctx.fill();
  }
  cctx.globalCompositeOperation = "source-over";

  // bake the SAME macro blobs (soft, subtle) into AO so dips read darker
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = size * (0.14 + Math.random() * 0.22);
    const grad = actx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(70,70,70,${0.1 + Math.random() * 0.14})`);
    grad.addColorStop(1, "rgba(70,70,70,0)");
    actx.fillStyle = grad;
    actx.beginPath();
    actx.arc(x, y, r, 0, Math.PI * 2);
    actx.fill();
  }

  // --- mowing stripes (alternating light/dark bands, slightly angled) ------
  cctx.save();
  cctx.globalCompositeOperation = "soft-light";
  cctx.translate(size / 2, size / 2);
  cctx.rotate(0.06);
  const bandW = size / 7;
  for (let i = -8; i < 8; i++) {
    cctx.fillStyle = i % 2 === 0 ? "rgba(235,245,220,0.10)" : "rgba(10,25,10,0.12)";
    cctx.fillRect(-size, i * bandW, size * 2, bandW);
  }
  cctx.restore();
  cctx.globalCompositeOperation = "source-over";

  // --- dense multi-tone blades ---------------------------------------------
  const blades = Math.round((size / 512) ** 2 * 42000);
  for (let i = 0; i < blades; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 3 + Math.random() * 7;
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    const dx = Math.cos(ang) * len;
    const dy = Math.sin(ang) * len;

    // blade tone varied around the base hue (some dry/yellowed, some deep)
    const dry = Math.random() < 0.08;
    const shade = (Math.random() - 0.5) * 2; // -1..1
    const r = THREE.MathUtils.clamp(br + shade * 34 + (dry ? 40 : 0), 10, 230);
    const g = THREE.MathUtils.clamp(bg + shade * 40 + (dry ? 30 : 0), 20, 235);
    const bl = THREE.MathUtils.clamp(bb + shade * 26 - (dry ? 10 : 0), 10, 210);
    cctx.strokeStyle = `rgb(${r | 0},${g | 0},${bl | 0})`;
    cctx.lineWidth = 0.6 + Math.random() * 1.0;
    cctx.beginPath();
    cctx.moveTo(x, y);
    cctx.lineTo(x + dx, y + dy);
    cctx.stroke();

    // normal perturbation: lean the blade's normal along its direction
    const nr = 128 + Math.cos(ang) * 72;
    const ng = 128 + Math.sin(ang) * 72;
    nctx.strokeStyle = `rgb(${nr | 0},${ng | 0},255)`;
    nctx.lineWidth = 1.0 + Math.random() * 0.5;
    nctx.beginPath();
    nctx.moveTo(x, y);
    nctx.lineTo(x + dx, y + dy);
    nctx.stroke();

    // roughness speckle (grass blades scatter — mostly rough, some glossier)
    const rv = 150 + Math.random() * 95;
    rctx.strokeStyle = `rgb(${rv | 0},${rv | 0},${rv | 0})`;
    rctx.lineWidth = 0.7 + Math.random() * 0.6;
    rctx.beginPath();
    rctx.moveTo(x, y);
    rctx.lineTo(x + dx, y + dy);
    rctx.stroke();

    // AO: tiny darkening at the blade root for inter-blade occlusion
    if (Math.random() < 0.3) {
      actx.strokeStyle = "rgba(40,40,40,0.25)";
      actx.lineWidth = 1.2;
      actx.beginPath();
      actx.moveTo(x, y + 1);
      actx.lineTo(x + dx * 0.4, y + dy * 0.4 + 1);
      actx.stroke();
    }
  }

  const mk = (c: HTMLCanvasElement, srgb = false, repeat = 5) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 16;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };

  return {
    color: mk(color, true),
    normal: mk(normal),
    rough: mk(rough),
    ao: mk(ao),
  };
}

/** Golf-ball dimple normal map (hex-packed depressions) — crisper, higher res. */
export function makeDimpleNormal(size = 1024): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#8080ff";
  ctx.fillRect(0, 0, size, size);

  const cols = 30;
  const r = size / cols / 2;
  for (let row = 0; row < cols + 1; row++) {
    for (let col = 0; col < cols + 1; col++) {
      const offset = row % 2 === 0 ? 0 : r;
      const cx = col * (size / cols) + offset;
      const cy = row * (size / cols) * 0.9;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.98);
      // concave dimple: flat center, normals bend outward sharply at the rim
      grad.addColorStop(0, "rgba(128,128,255,1)");
      grad.addColorStop(0.5, "rgba(128,128,255,1)");
      grad.addColorStop(0.78, "rgba(166,90,245,1)");
      grad.addColorStop(0.92, "rgba(90,166,245,1)");
      grad.addColorStop(1, "rgba(128,128,255,1)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Soft radial contact-shadow sprite (white bg, dark soft ellipse). */
export function makeContactShadow(size = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(0,0,0,0.9)");
  grad.addColorStop(0.45, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.75, "rgba(0,0,0,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}
