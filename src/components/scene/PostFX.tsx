"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, DepthOfField, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useAnim } from "./AnimContext";
import { scene } from "@/lib/config";
import { groundHeight } from "@/lib/heightfield";
import { buildTrajectoryCurve } from "@/lib/trajectoryCurve";

export interface PostAppearance {
  bokehScale: number;
  focusRange: number;
  bloomIntensity: number;
  bloomThreshold: number;
  vignetteDarkness: number;
  grain: number;
}

/**
 * Tasteful, perf-capped post stack. DoF keeps the ball crisp while the turf
 * falls off softly; bloom is thresholded so only the bright scan/line accents
 * catch it (not the whole scene); plus a gentle vignette + light grain.
 * Mounted ONLY on desktop with motion enabled (see Scene).
 */
export function PostFX({ appearance, breakAmount }: { appearance: PostAppearance; breakAmount: number }) {
  const anim = useAnim();
  const curve = useMemo(() => buildTrajectoryCurve(breakAmount), [breakAmount]);

  const restPos = useMemo(() => {
    const [x, z] = scene.ballXZ;
    return new THREE.Vector3(x, groundHeight(x, z) + scene.ballRadius, z);
  }, []);
  // Stable Vector3 the DepthOfField effect holds as its autofocus target;
  // mutated in place each frame so focus tracks the ball under scrub.
  const focusTarget = useMemo(() => new THREE.Vector3().copy(restPos), [restPos]);
  const p = useRef(new THREE.Vector3());

  useFrame(() => {
    const t = THREE.MathUtils.clamp(anim.ballRoll, 0, 1);
    if (t <= 0.0001) {
      focusTarget.copy(restPos);
    } else {
      curve.getPointAt(t, p.current);
      p.current.y += scene.ballRadius;
      focusTarget.copy(p.current);
    }
  });

  return (
    <EffectComposer multisampling={2} enableNormalPass={false}>
      <DepthOfField
        target={focusTarget}
        focusRange={appearance.focusRange}
        bokehScale={appearance.bokehScale}
      />
      <Bloom
        intensity={appearance.bloomIntensity}
        luminanceThreshold={appearance.bloomThreshold}
        luminanceSmoothing={0.2}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.28} darkness={appearance.vignetteDarkness} />
      <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={appearance.grain} />
    </EffectComposer>
  );
}
