"use client";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useEffect } from "react";
import * as THREE from "three";
import type { AnimState } from "@/lib/animState";
import { AnimContext } from "./AnimContext";
import { Green } from "./Green";
import { GolfBall } from "./GolfBall";
import { FlagAndHole } from "./FlagAndHole";
import { ScanMesh, type ScanAppearance } from "./ScanMesh";
import { Trajectory, type TrajectoryAppearance } from "./Trajectory";
import { CameraRig } from "./CameraRig";

export interface SceneProps {
  anim: AnimState;
  fov: number;
  scanAppearance: ScanAppearance;
  trajectoryAppearance: TrajectoryAppearance;
  reducedMotion: boolean;
}

/** Keeps the perspective camera's FOV in sync with live/viewport changes. */
function FovUpdater({ fov }: { fov: number }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useEffect(() => {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }, [camera, fov]);
  return null;
}

/** The ONE mounted Canvas — a single continuous 3D environment. */
export function Scene({ anim, fov, scanAppearance, trajectoryAppearance, reducedMotion }: SceneProps) {
  const breakAmount = trajectoryAppearance.breakAmount;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop="always"
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true, // allow canvas screenshots / OG capture
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.92,
      }}
      camera={{ fov, near: 0.05, far: 120, position: [anim.camX, anim.camY, anim.camZ] }}
      onCreated={() => {
        // ensure R3F measures the real container size on first mount
        requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
      }}
    >
      <color attach="background" args={["#060a0f"]} />
      <fog attach="fog" args={["#0b131b", 26, 82]} />

      <AnimContext.Provider value={anim}>
        {/* cinematic lighting: low ambient + hemi fill, key, cool rim */}
        <ambientLight intensity={0.18} />
        <hemisphereLight args={["#3a4a68", "#0b1410", 0.5]} />
        <directionalLight
          position={[5, 9, 3]}
          intensity={3.0}
          color="#fff3df"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-near={1}
          shadow-camera-far={40}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[-6, 4, -7]} intensity={1.5} color="#8fb4ff" />
        <directionalLight position={[-3, 3, 6]} intensity={0.7} color="#bcd0ff" />

        {/* offline HDRI-like environment for believable ball reflections */}
        <Environment resolution={256} frames={1}>
          <Lightformer intensity={2.2} position={[4, 6, 4]} scale={[6, 6, 1]} color="#fff4e2" />
          <Lightformer intensity={1.1} position={[-5, 4, -4]} scale={[5, 5, 1]} color="#9bc0ff" />
          <Lightformer intensity={0.8} position={[0, 7, -6]} scale={[10, 3, 1]} color="#cfe0ff" />
          <Lightformer intensity={0.5} form="ring" position={[0, 3, 7]} scale={[3, 3, 1]} color="#ffffff" />
        </Environment>

        <Green />
        <ScanMesh appearance={scanAppearance} />
        <Trajectory appearance={trajectoryAppearance} />
        <FlagAndHole reducedMotion={reducedMotion} />
        <GolfBall breakAmount={breakAmount} />

        <FovUpdater fov={fov} />
        <CameraRig breakAmount={breakAmount} />
      </AnimContext.Provider>
    </Canvas>
  );
}
