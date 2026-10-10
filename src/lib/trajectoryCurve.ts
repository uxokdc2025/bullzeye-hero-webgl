/**
 * trajectoryCurve.ts — builds the illustrative putt curve from ball to cup.
 * The path bows laterally (the "break") and rides just above the shared
 * ground heightfield, so it reads as a real rolling line over the contours.
 */
import * as THREE from "three";
import { scene, trajectory } from "./config";
import { groundHeight } from "./heightfield";

export function buildTrajectoryCurve(breakAmount = trajectory.breakAmount): THREE.CatmullRomCurve3 {
  const [bx, bz] = scene.ballXZ;
  const [hx, hz] = scene.holeXZ;
  // Hug the grass: just the thin tube radius + a hair of clearance so the line
  // lies flat on the contours instead of floating as a raised pipe.
  const lift = trajectory.clearance + trajectory.radius;

  // Lateral break: offset the mid of the path perpendicular to ball->hole.
  const dirX = hx - bx;
  const dirZ = hz - bz;
  const len = Math.hypot(dirX, dirZ) || 1;
  // perpendicular (points to the "high side" the ball breaks across)
  const perpX = -dirZ / len;
  const perpZ = dirX / len;

  const samples = 8;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    // base straight interpolation
    let x = bx + dirX * t;
    let z = bz + dirZ * t;
    // apply a smooth sideways bow that peaks mid-path and returns to the cup
    const bow = Math.sin(t * Math.PI) * breakAmount * (1 - t * 0.25);
    x += perpX * bow;
    z += perpZ * bow;
    const y = groundHeight(x, z) + lift;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
  return curve;
}
