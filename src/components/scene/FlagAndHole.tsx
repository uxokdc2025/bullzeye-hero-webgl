"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { scene } from "@/lib/config";
import { groundHeight } from "@/lib/heightfield";

/** The cup (recessed dark cylinder + rim), the flagstick, and a gently waving flag. */
export function FlagAndHole({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const [hx, hz] = scene.holeXZ;
  const hy = groundHeight(hx, hz);

  const flagGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.85, 0.5, 20, 10);
    g.translate(0.425, 0, 0); // pivot at the stick
    return g;
  }, []);
  const flagMat = useRef<THREE.ShaderMaterial>(null);

  const flagUniforms = useMemo(
    () => ({ uTime: { value: 0 } }),
    []
  );

  useFrame((state) => {
    if (flagMat.current && !reducedMotion) flagUniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group position={[hx, hy, hz]}>
      {/* cup: recessed dark cylinder */}
      <mesh position={[0, -0.18, 0]}>
        <cylinderGeometry args={[scene.holeRadius, scene.holeRadius * 0.92, 0.42, 40, 1, true]} />
        <meshStandardMaterial color="#050607" roughness={1} metalness={0} side={THREE.BackSide} />
      </mesh>
      {/* cup floor */}
      <mesh position={[0, -0.39, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[scene.holeRadius, 40]} />
        <meshStandardMaterial color="#0a0c0d" roughness={1} />
      </mesh>
      {/* rim */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[scene.holeRadius * 0.92, scene.holeRadius * 1.08, 48]} />
        <meshStandardMaterial color="#cfd6d0" roughness={0.6} metalness={0.1} side={THREE.DoubleSide} />
      </mesh>

      {/* flagstick */}
      <mesh position={[0, scene.flagHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, scene.flagHeight, 10]} />
        <meshStandardMaterial color="#d8dde0" roughness={0.35} metalness={0.5} />
      </mesh>
      {/* stick tip */}
      <mesh position={[0, scene.flagHeight + 0.04, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#e8ebe8" roughness={0.3} metalness={0.5} />
      </mesh>

      {/* flag (subtle wave) */}
      <mesh geometry={flagGeo} position={[0.022, scene.flagHeight - 0.42, 0]}>
        <shaderMaterial
          ref={flagMat}
          uniforms={flagUniforms}
          side={THREE.DoubleSide}
          vertexShader={`
            uniform float uTime;
            varying vec2 vUv;
            varying float vShade;
            void main(){
              vUv = uv;
              vec3 p = position;
              float wave = sin(p.x * 7.0 - uTime * 3.0) * 0.06 * p.x
                         + sin(p.x * 3.0 - uTime * 1.6) * 0.04 * p.x;
              p.z += wave;
              vShade = 0.75 + wave * 1.6;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
          `}
          fragmentShader={`
            varying vec2 vUv;
            varying float vShade;
            void main(){
              vec3 base = mix(vec3(0.42,0.16,0.62), vec3(0.62,0.28,0.78), vUv.x);
              gl_FragColor = vec4(base * vShade, 1.0);
            }
          `}
        />
      </mesh>
    </group>
  );
}
