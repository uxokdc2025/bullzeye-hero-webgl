/** Shared shapes for the live-tunable config the Leva panel produces. */
import type { Vec3 } from "./config";
import type { ScanAppearance } from "@/components/scene/ScanMesh";
import type { TrajectoryAppearance } from "@/components/scene/Trajectory";
import type { GrassAppearance } from "@/components/scene/Green";
import type { ContactShadowAppearance } from "@/components/scene/Scene";
import type { PostAppearance } from "@/components/scene/PostFX";

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
  grass: GrassAppearance;
  ballEnvIntensity: number;
  contactShadow: ContactShadowAppearance;
  scan: ScanAppearance;
  trajectory: TrajectoryAppearance;
  post: PostAppearance;
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
