"use client";
import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { green } from "@/lib/config";
import { groundHeight } from "@/lib/heightfield";
import { makeGrassTextures } from "@/lib/textures";

export interface GrassAppearance {
  tone: string;
  tiling: number;
  sheen: number;
  normalStrength: number;
  envIntensity: number;
}

/** Contoured, photographic dark-grass putting green displaced by the shared heightfield. */
export function Green({ appearance }: { appearance: GrassAppearance }) {
  const geometry = useMemo(() => {
    const W = green.size * 2;
    const geo = new THREE.PlaneGeometry(W, W, green.segments, green.segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, groundHeight(x, z));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    // aoMap samples the second UV set (attribute `uv1`); reuse the base UVs.
    geo.setAttribute("uv1", geo.attributes.uv);
    return geo;
  }, []);

  // Bake once at mount; tone edits re-bake (cheap, only on Leva tweaks).
  const tex = useMemo(() => makeGrassTextures(1024, appearance.tone), [appearance.tone]);

  // Live-apply tiling without re-baking the canvas.
  useEffect(() => {
    for (const t of [tex.color, tex.normal, tex.rough, tex.ao]) {
      t.repeat.set(appearance.tiling, appearance.tiling);
      t.needsUpdate = true;
    }
  }, [tex, appearance.tiling]);

  useEffect(() => {
    return () => {
      tex.color.dispose();
      tex.normal.dispose();
      tex.rough.dispose();
      tex.ao.dispose();
    };
  }, [tex]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshPhysicalMaterial
        map={tex.color}
        normalMap={tex.normal}
        normalScale={new THREE.Vector2(appearance.normalStrength, appearance.normalStrength)}
        roughnessMap={tex.rough}
        roughness={0.92}
        metalness={0}
        aoMap={tex.ao}
        aoMapIntensity={1.0}
        color="#ffffff"
        sheen={appearance.sheen}
        sheenRoughness={0.75}
        sheenColor={new THREE.Color("#aef0a0")}
        envMapIntensity={appearance.envIntensity}
      />
    </mesh>
  );
}
