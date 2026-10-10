/** Shared shapes for the live-tunable config the Leva panel produces. */
import type { Vec3 } from "./config";
import type { ScanAppearance } from "@/components/scene/ScanMesh";
import type { TrajectoryAppearance } from "@/components/scene/Trajectory";

export interface TunedBeat {
  name: string;
  pos: Vec3;
  target: Vec3;
  length: number;
  ease: string;
}

export interface TunedTiming {
  scrollVH: number;
  scrub: number;
  gridDraw: number;
  facetFill: number;
  trajectoryDraw: number;
  ballRoll: number;
  scanRecede: number;
}

export interface TunedConfig {
  fov: number;
  beats: TunedBeat[];
  scan: ScanAppearance;
  trajectory: TrajectoryAppearance;
  timing: TunedTiming;
}

export const EASE_OPTIONS = [
  "none",
  "power1.inOut",
  "power2.inOut",
  "power3.inOut",
  "power1.out",
  "power2.out",
  "sine.inOut",
  "expo.inOut",
];
