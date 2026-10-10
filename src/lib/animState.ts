/**
 * animState.ts — the single mutable "proxy" the GSAP timeline tweens and that
 * the R3F scene reads every frame. Keeping all driven values in one plain
 * object is what makes forward AND reverse scrubbing coherent and
 * deterministic: scroll -> timeline.progress -> these numbers -> the scene.
 */
export interface AnimState {
  /** camera position (world) */
  camX: number;
  camY: number;
  camZ: number;
  /** camera look-at target */
  tgtX: number;
  tgtY: number;
  tgtZ: number;
  /** 0..1 grid line reveal sweep */
  gridDraw: number;
  /** 0..1 faceted glass fill sweep */
  facetFill: number;
  /** 0..1 global scan opacity multiplier (recedes during trajectory beat) */
  scanOpacity: number;
  /** 0..1 trajectory line draw-on */
  trajectoryDraw: number;
  /** 0..1 ball progress along the trajectory */
  ballRoll: number;
  /** 0..1 how strongly the rig tracks the rolling ball (money shot) */
  followBlend: number;
  /** master 0..1 progress of the whole timeline (for derived effects) */
  progress: number;
}

export function createAnimState(): AnimState {
  return {
    camX: 0,
    camY: 0,
    camZ: 5,
    tgtX: 0,
    tgtY: 0,
    tgtZ: 0,
    gridDraw: 0,
    facetFill: 0,
    scanOpacity: 1,
    trajectoryDraw: 0,
    ballRoll: 0,
    followBlend: 0,
    progress: 0,
  };
}
