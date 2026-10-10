"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { useAnim } from "./AnimContext";
import { scene } from "@/lib/config";
import { buildTrajectoryCurve } from "@/lib/trajectoryCurve";

/**
 * Drives the camera every frame from the timeline-updated anim state.
 * During the money shot, blends the framing toward tracking the rolling ball
 * (followBlend 0..1) using the SAME trajectory the ball rolls along — so the
 * follow stays deterministic under forward/reverse scrubbing.
 */
export function CameraRig({ breakAmount }: { breakAmount: number }) {
  const anim = useAnim();
  const { camera } = useThree();
  const curve = useMemo(() => buildTrajectoryCurve(breakAmount), [breakAmount]);

  const target = useMemo(() => new THREE.Vector3(), []);
  const desiredPos = useMemo(() => new THREE.Vector3(), []);
  const ballPos = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const followPos = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    desiredPos.set(anim.camX, anim.camY, anim.camZ);
    target.set(anim.tgtX, anim.tgtY, anim.tgtZ);

    if (anim.followBlend > 0.001) {
      const t = THREE.MathUtils.clamp(anim.ballRoll, 0, 1);
      curve.getPointAt(t, ballPos);
      curve.getTangentAt(t, tangent);
      // camera sits behind + above the ball along its travel, offset slightly
      // to the side so the flagstick doesn't block the cup on the final drop
      followPos.copy(ballPos)
        .addScaledVector(tangent, -1.7)
        .add(new THREE.Vector3(0.55, 1.15, 0));
      desiredPos.lerp(followPos, anim.followBlend);
      // look at the ball (easing slightly ahead early, onto the ball at the cup)
      const aheadAmt = 0.9 * (1.0 - t);
      const look = ballPos.clone().addScaledVector(tangent, aheadAmt);
      look.y += scene.ballRadius * 0.5;
      target.lerp(look, anim.followBlend);
    }

    camera.position.copy(desiredPos);
    camera.lookAt(target);
  });

  return null;
}
