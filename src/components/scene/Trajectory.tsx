"use client";
import { useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAnim } from "./AnimContext";
import { buildTrajectoryCurve } from "@/lib/trajectoryCurve";

export interface TrajectoryAppearance {
  color: string;
  tipColor: string;
  opacity: number;
  radius: number;
  breakAmount: number;
}

/**
 * Illustrative curved putt line (clearly NOT measured data). A thin tube that
 * draws on from ball to cup as anim.trajectoryDraw goes 0 -> 1, with a bright
 * leading tip. Refined cyan/blue — subtle, not a glowing halo.
 */
const TRAJ_VERT = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main(){
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const TRAJ_FRAG = /* glsl */ `
  precision highp float;
  uniform float uDraw;
  uniform vec3 uColor;
  uniform vec3 uTip;
  uniform float uOpacity;
  varying float vT;
  void main(){
    if (vT > uDraw) discard;
    float tip = smoothstep(uDraw - 0.05, uDraw, vT);
    vec3 col = mix(uColor, uTip, tip);
    float a = uOpacity * (0.85 + tip * 0.15);
    gl_FragColor = vec4(col, a);
  }
`;

export function Trajectory({ appearance }: { appearance: TrajectoryAppearance }) {
  const anim = useAnim();

  const geo = useMemo(() => {
    const curve = buildTrajectoryCurve(appearance.breakAmount);
    const tubular = 180;
    const radial = 10;
    const g = new THREE.TubeGeometry(curve, tubular, appearance.radius, radial, false);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const aT = new Float32Array(pos.count);
    const perRing = radial + 1;
    for (let i = 0; i < pos.count; i++) {
      const ring = Math.floor(i / perRing);
      aT[i] = ring / tubular;
    }
    g.setAttribute("aT", new THREE.BufferAttribute(aT, 1));
    return g;
  }, [appearance.breakAmount, appearance.radius]);

  const uniforms = useMemo(
    () => ({
      uDraw: { value: 0 },
      uColor: { value: new THREE.Color(appearance.color) },
      uTip: { value: new THREE.Color(appearance.tipColor) },
      uOpacity: { value: appearance.opacity },
    }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: TRAJ_VERT,
        fragmentShader: TRAJ_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    [uniforms]
  );

  useEffect(() => {
    return () => {
      geo.dispose();
      material.dispose();
    };
  }, [geo, material]);

  useFrame(() => {
    uniforms.uDraw.value = anim.trajectoryDraw;
    uniforms.uColor.value.set(appearance.color);
    uniforms.uTip.value.set(appearance.tipColor);
    uniforms.uOpacity.value = appearance.opacity;
  });

  return <mesh geometry={geo} material={material} />;
}
