"use client";
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAnim } from "./AnimContext";
import { scene } from "@/lib/config";
import { groundHeight } from "@/lib/heightfield";
import { makeDimpleNormal, makeContactShadow } from "@/lib/textures";
import { buildTrajectoryCurve } from "@/lib/trajectoryCurve";

export interface BallShadowAppearance {
  opacity: number;
  ballScale: number;
}

/**
 * Realistic PBR golf ball with a subtle clearcoat (polished tour-ball finish).
 * Rests on the green at the start, then rolls along the shared trajectory curve
 * into the cup as anim.ballRoll goes 0 -> 1. A soft contact shadow follows it
 * so it always reads as grounded on the turf.
 */
export function GolfBall({
  breakAmount,
  envIntensity,
  shadow,
}: {
  breakAmount: number;
  envIntensity: number;
  shadow: BallShadowAppearance;
}) {
  const anim = useAnim();
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const shadowMat = useRef<THREE.MeshBasicMaterial>(null);

  const curve = useMemo(() => buildTrajectoryCurve(breakAmount), [breakAmount]);
  const dimples = useMemo(() => makeDimpleNormal(1024), []);
  const shadowTex = useMemo(() => makeContactShadow(256), []);

  const restPos = useMemo(() => {
    const [x, z] = scene.ballXZ;
    return new THREE.Vector3(x, groundHeight(x, z) + scene.ballRadius, z);
  }, []);

  const p = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const lastPos = useRef(new THREE.Vector3().copy(restPos));
  const rollAxis = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useEffect(() => {
    return () => {
      dimples.dispose();
      shadowTex.dispose();
    };
  }, [dimples, shadowTex]);

  useFrame(() => {
    if (!group.current || !mesh.current) return;
    const t = THREE.MathUtils.clamp(anim.ballRoll, 0, 1);
    let dropFade = 1;

    if (t <= 0.0001) {
      group.current.position.copy(restPos);
      lastPos.current.copy(restPos);
    } else {
      curve.getPointAt(t, p);
      p.y += scene.ballRadius;
      // near the end, let the ball settle down into the cup
      if (t > 0.92) {
        const drop = (t - 0.92) / 0.08;
        p.y -= drop * (scene.ballRadius + 0.22);
        dropFade = 1 - drop;
      }
      group.current.position.copy(p);

      // roll the ball: rotate about the axis perpendicular to travel
      curve.getTangentAt(t, tangent);
      const dist = p.distanceTo(lastPos.current);
      if (dist > 1e-5) {
        rollAxis.crossVectors(up, tangent).normalize();
        const angle = dist / scene.ballRadius;
        mesh.current.rotateOnWorldAxis(rollAxis, angle);
      }
      lastPos.current.copy(p);
    }

    // keep the contact shadow pinned to the local ground under the ball
    if (shadowRef.current && shadowMat.current) {
      const gx = group.current.position.x;
      const gz = group.current.position.z;
      const gy = groundHeight(gx, gz);
      shadowRef.current.position.y = gy - group.current.position.y + 0.012;
      shadowMat.current.opacity = shadow.opacity * Math.max(dropFade, 0);
    }
  });

  return (
    <group ref={group} position={restPos}>
      <mesh ref={mesh} castShadow>
        <sphereGeometry args={[scene.ballRadius, 64, 64]} />
        <meshPhysicalMaterial
          color="#eef0ec"
          roughness={0.34}
          metalness={0.02}
          clearcoat={0.55}
          clearcoatRoughness={0.22}
          normalMap={dimples}
          normalScale={new THREE.Vector2(1.0, 1.0)}
          clearcoatNormalMap={dimples}
          clearcoatNormalScale={new THREE.Vector2(0.35, 0.35)}
          envMapIntensity={envIntensity}
        />
      </mesh>
      {/* grounding contact shadow (baked soft disc, follows the ball) */}
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -scene.ballRadius + 0.012, 0]}>
        <planeGeometry args={[scene.ballRadius * shadow.ballScale, scene.ballRadius * shadow.ballScale]} />
        <meshBasicMaterial
          ref={shadowMat}
          map={shadowTex}
          transparent
          opacity={shadow.opacity}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
