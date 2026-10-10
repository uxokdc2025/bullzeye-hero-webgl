"use client";
import { useMemo, useEffect } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { green } from "@/lib/config";
import { groundHeight } from "@/lib/heightfield";

export interface GrassAppearance {
  /** multiply TINT over the scanned albedo (deep-jade grade) */
  tone: string;
  tiling: number;
  sheen: number;
  normalStrength: number;
  envIntensity: number;
}

/** Real scanned CC0 grass PBR set (ambientCG Grass004). */
const GRASS_MAPS = {
  map: "/textures/grass/grass_color.jpg",
  normalMap: "/textures/grass/grass_normal.jpg",
  roughnessMap: "/textures/grass/grass_roughness.jpg",
  aoMap: "/textures/grass/grass_ao.jpg",
};

/**
 * Contoured putting-green base plane displaced by the shared heightfield and
 * surfaced with a REAL scanned grass PBR material (albedo + normal + roughness
 * + AO). Macro tiling is broken up by the scanned content itself + a tint; the
 * instanced 3D blades (see Grass.tsx) sit on top, this fills the gaps between.
 */
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

  const { map, normalMap, roughnessMap, aoMap } = useTexture(GRASS_MAPS);

  // Static texture setup (color space + wrapping + anisotropy), done once.
  useEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    for (const t of [map, normalMap, roughnessMap, aoMap]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 16;
      t.needsUpdate = true;
    }
  }, [map, normalMap, roughnessMap, aoMap]);

  // Live tiling (no re-fetch).
  useEffect(() => {
    for (const t of [map, normalMap, roughnessMap, aoMap]) {
      t.repeat.set(appearance.tiling, appearance.tiling);
      t.needsUpdate = true;
    }
  }, [map, normalMap, roughnessMap, aoMap, appearance.tiling]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshPhysicalMaterial
        map={map}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(appearance.normalStrength, appearance.normalStrength)}
        roughnessMap={roughnessMap}
        roughness={1.0}
        metalness={0}
        aoMap={aoMap}
        aoMapIntensity={1.0}
        color={new THREE.Color(appearance.tone)}
        sheen={appearance.sheen}
        sheenRoughness={0.75}
        sheenColor={new THREE.Color("#aef0a0")}
        envMapIntensity={appearance.envIntensity}
        dithering
      />
    </mesh>
  );
}
