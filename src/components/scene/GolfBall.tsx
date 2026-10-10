"use client";
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAnim } from "./AnimContext";
import { scene } from "@/lib/config";
import { groundHeight } from "@/lib/heightfield";
import { makeDimpleNormal } from "@/lib/textures";
import { buildTrajectoryCurve } from "@/lib/trajectoryCurve";

/**
 * Realistic PBR golf ball. Rests on the green at the start, then rolls along
 * the shared trajectory curve into the cup as anim.ballRoll goes 0 -> 1.
 */
export function GolfBall({ breakAmount }: { breakAmount: number }) {
  const anim = useAnim();
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);

  const curve = useMemo(() => buildTrajectoryCurve(breakAmount), [breakAmount]);
  const dimples = useMemo(() => makeDimpleNormal(512), []);

  const restPos = useMemo(() => {
    const [x, z] = scene.ballXZ;
    return new THREE.Vector3(x, groundHeight(x, z) + scene.ballRadius, z);
  }, []);

  const p = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const lastPos = useRef(new THREE.Vector3().copy(restPos));
  const rollAxis = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useEffect(() => () => dimples.dispose(), [dimples]);

  useFrame(() => {
    if (!group.current || !mesh.current) return;
    const t = THREE.MathUtils.clamp(anim.ballRoll, 0, 1);

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
  });

  return (
    <group ref={group} position={restPos}>
      <mesh ref={mesh} castShadow>
        <sphereGeometry args={[scene.ballRadius, 64, 64]} />
        <meshStandardMaterial
          color="#f6f7f4"
          roughness={0.32}
          metalness={0.04}
          normalMap={dimples}
          normalScale={new THREE.Vector2(0.9, 0.9)}
          envMapIntensity={0.9}
        />
      </mesh>
    </group>
  );
}
