"use client";
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAnim } from "./AnimContext";
import { grassBlades } from "@/lib/config";
import { groundHeight, groundNormal } from "@/lib/heightfield";

/** The live-tunable slice of the blade field. */
export interface GrassBladesAppearance {
  /** instance count (desktop vs mobile is decided by the caller) */
  count: number;
  /** base blade height (world units) */
  height: number;
  /** +/- height variance fraction */
  heightVar: number;
  /** idle wind-sway amount (0 => perfectly still, e.g. reduced-motion) */
  sway: number;
  /** overall blade tint */
  tint: string;
}

/** Deterministic PRNG so the scatter is stable across rebuilds / scrubbing. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A single tapered, forward-curved blade. Pivot at the base (y = 0), so the
 * instance matrix drops it straight onto the heightfield. uv.y (0 at root ->
 * 1 at tip) drives both the wind sway falloff and the root->tip shading.
 */
function makeBladeGeometry(height: number, width: number): THREE.PlaneGeometry {
  const segs = 4;
  const g = new THREE.PlaneGeometry(width, height, 1, segs);
  g.translate(0, height / 2, 0); // base at origin, grows +y
  const pos = g.attributes.position as THREE.BufferAttribute;
  const tip = new Float32Array(pos.count); // 0 at root -> 1 at tip (no reliance on uv)
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const f = THREE.MathUtils.clamp(y / height, 0, 1);
    tip[i] = f;
    pos.setX(i, pos.getX(i) * (1 - f * 0.9)); // taper to a point
    pos.setZ(i, pos.getZ(i) + Math.pow(f, 2) * height * 0.22); // gentle forward curve
  }
  pos.needsUpdate = true;
  g.setAttribute("aTip", new THREE.BufferAttribute(tip, 1));
  g.computeVertexNormals();
  return g;
}

/**
 * Instanced 3D grass. One InstancedMesh (one draw call) of tapered curved
 * blades scattered on the shared heightfield, concentrated toward the ball and
 * faded out at the scatter edge. A MeshStandardMaterial (so it takes the HDRI +
 * directional key + shadows + N8AO like everything else) is extended via
 * onBeforeCompile with a cheap tip-only wind sway and a root->tip shade ramp.
 * The displaced textured ground plane stays underneath to fill the gaps.
 */
export function Grass({ appearance }: { appearance: GrassBladesAppearance }) {
  const anim = useAnim();

  // Wind + edge-fade uniforms, shared into the patched standard material.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSway: { value: appearance.sway },
      uCenter: { value: new THREE.Vector2(grassBlades.center[0], grassBlades.center[1]) },
      uRadius: { value: grassBlades.radius },
    }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(appearance.tint),
      roughness: 0.82,
      metalness: 0,
      side: THREE.DoubleSide,
      vertexColors: true, // per-blade instanceColor
      // low green emissive floor so blades facing away from the key / in shadow
      // never crush to black (cheap stand-in for leaf translucency / sky bounce)
      emissive: new THREE.Color("#17351d"),
      emissiveIntensity: 1,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uSway = uniforms.uSway;
      shader.uniforms.uCenter = uniforms.uCenter;
      shader.uniforms.uRadius = uniforms.uRadius;
      shader.vertexShader =
        "uniform float uTime;\nuniform float uSway;\nuniform vec2 uCenter;\nuniform float uRadius;\nattribute float aTip;\nvarying float vTip;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          /* glsl */ `#include <begin_vertex>
            vTip = aTip;
            // per-instance world xz from the instance matrix translation column
            vec3 iPos = instanceMatrix[3].xyz;
            // tip-only bend (base stays planted: weighted by vTip^2)
            float phase = iPos.x * 0.7 + iPos.z * 0.7;
            float s = sin(uTime * 1.15 + phase) + 0.5 * sin(uTime * 2.1 + phase * 1.7);
            float bend = s * uSway * vTip * vTip;
            transformed.x += bend * 0.11;
            transformed.z += bend * 0.07;
            // LOD/edge fade: collapse blades toward the scatter boundary so the
            // disc has no hard edge and distant blades cost nothing to shade
            float d = length(iPos.xz - uCenter);
            float edge = 1.0 - smoothstep(uRadius * 0.82, uRadius, d);
            transformed.xyz *= edge;
          `
        );
      shader.fragmentShader =
        "varying float vTip;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          /* glsl */ `#include <color_fragment>
            // brighter toward the tip -> blades read as lush green catching
            // light; root kept near full so nothing reads as black spikes
            diffuseColor.rgb *= mix(0.95, 1.4, vTip);
          `
        );
    };
    mat.customProgramCacheKey = () => "bullzeye-grass-blade";
    return mat;
  }, [appearance.tint, uniforms]);

  // Build the InstancedMesh imperatively: full control of per-instance matrix +
  // color, deterministic scatter, easy disposal. Rebuilt only when count/height
  // change (a Leva tweak), never per frame.
  const mesh = useMemo(() => {
    const count = Math.max(0, Math.floor(appearance.count));
    const geo = makeBladeGeometry(appearance.height, grassBlades.width);
    const inst = new THREE.InstancedMesh(geo, material, count);
    inst.castShadow = false; // perf: blades don't cast into the shadow map
    inst.receiveShadow = true; // but the directional shadow + AO darken them
    inst.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    const rand = mulberry32(0xb0115e);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const tint = new THREE.Color(appearance.tint);
    const up = new THREE.Vector3(0, 1, 0);
    const nrm = new THREE.Vector3();
    const lean = new THREE.Vector3();
    const qTilt = new THREE.Quaternion();
    const qSpin = new THREE.Quaternion();

    const [cx, cz] = grassBlades.center;
    const [bx, bz] = [0, 4.2]; // ball xz (scene.ballXZ)

    for (let i = 0; i < count; i++) {
      let x: number;
      let z: number;
      if (rand() < grassBlades.ballBias) {
        // tight gaussian-ish cluster around the ball (sum of uniforms)
        const r = (rand() + rand() + rand()) / 3 - 0.5; // ~[-0.5,0.5] bell
        const r2 = (rand() + rand() + rand()) / 3 - 0.5;
        x = bx + r * 6.0;
        z = bz + r2 * 6.0;
      } else {
        // inward-biased disc over the whole framing
        const ang = rand() * Math.PI * 2;
        const rad = Math.pow(rand(), 0.7) * grassBlades.radius;
        x = cx + Math.cos(ang) * rad;
        z = cz + Math.sin(ang) * rad;
      }

      const gy = groundHeight(x, z);
      dummy.position.set(x, gy, z);

      // sit on the slope: lean the blade partway toward the ground normal
      const n = groundNormal(x, z);
      nrm.set(n[0], n[1], n[2]);
      lean.lerpVectors(up, nrm, 0.4).normalize();
      qTilt.setFromUnitVectors(up, lean);
      // random heading + a touch of extra natural tilt
      qSpin.setFromAxisAngle(up, rand() * Math.PI * 2);
      dummy.quaternion.copy(qTilt).multiply(qSpin);

      const hv = 1 + (rand() - 0.5) * 2 * appearance.heightVar;
      const wv = 0.8 + rand() * 0.5;
      dummy.scale.set(wv, Math.max(0.35, hv), 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);

      // per-blade tint jitter (hue/sat/lightness) so the field isn't uniform —
      // kept tight + slightly biased lighter so no blade reads as black
      color.copy(tint).offsetHSL(
        (rand() - 0.5) * 0.03,
        (rand() - 0.5) * 0.1,
        (rand() - 0.4) * 0.16
      );
      inst.setColorAt(i, color);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere(); // so frustum culling accounts for the spread
    inst.frustumCulled = true;
    return inst;
  }, [appearance.count, appearance.height, appearance.heightVar, appearance.tint, material]);

  // live sway amount from Leva / reduced-motion
  useEffect(() => {
    uniforms.uSway.value = appearance.sway;
  }, [appearance.sway, uniforms]);

  // advance wind time only when there's sway to spend frames on
  useFrame((state) => {
    if (uniforms.uSway.value > 0.0001) uniforms.uTime.value = state.clock.elapsedTime;
    // keep the overall tint live with Leva edits
    (material as THREE.MeshStandardMaterial).color.set(appearance.tint);
  });

  useEffect(() => {
    return () => {
      mesh.geometry.dispose();
    };
  }, [mesh]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  // ignore the stable anim proxy here — grass is driven by wind + Leva only
  void anim;

  return <primitive object={mesh} />;
}
