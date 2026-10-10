/**
 * heightfield.ts — the ONE contour function for the whole scene.
 *
 * The green mesh, the faceted scan overlay, the trajectory and the rolling
 * ball all read their vertical position from groundHeight(x, z), so every
 * element hugs the exact same slopes and breaks.
 */
import { green } from "./config";

/**
 * Smooth rolling putting-green surface with a readable slope + break.
 * Deterministic (pure function of x, z) so forward/reverse scrubbing is stable.
 */
export function groundHeight(x: number, z: number): number {
  let h = 0;
  // broad rolling undulation across the whole green
  h += 0.62 * Math.sin(x * 0.26 + 0.6) * Math.cos(z * 0.21 - 0.3);
  // a raised swell on the left-back quarter
  h += 0.78 * Math.exp(-(((x + 3.2) ** 2) + ((z + 2.0) ** 2)) / 34);
  // a gentle valley the putt will break through
  h -= 0.55 * Math.exp(-(((x - 3.0) ** 2) + ((z - 1.5) ** 2)) / 40);
  // subtle micro-undulation for texture in the contour
  h += 0.12 * Math.sin(x * 0.85) * Math.sin(z * 0.72 + 0.4);
  // flatten slightly toward the cup so the ball can settle
  const [hx, hz] = [2.6, -4.6];
  h -= 0.35 * Math.exp(-(((x - hx) ** 2) + ((z - hz) ** 2)) / 6);
  return h * green.heightScale;
}

/** Approximate surface normal via finite differences (for sitting objects). */
export function groundNormal(x: number, z: number): [number, number, number] {
  const e = 0.1;
  const hL = groundHeight(x - e, z);
  const hR = groundHeight(x + e, z);
  const hD = groundHeight(x, z - e);
  const hU = groundHeight(x, z + e);
  const nx = hL - hR;
  const nz = hD - hU;
  const ny = 2 * e;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}
