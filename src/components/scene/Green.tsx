"use client";
import { useMemo, useEffect } from "react";
import * as THREE from "three";
import { green } from "@/lib/config";
import { groundHeight } from "@/lib/heightfield";
import { makeGrassTextures } from "@/lib/textures";

/** Contoured, photographic dark-grass putting green displaced by the shared heightfield. */
export function Green() {
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
    return geo;
  }, []);

  const tex = useMemo(() => makeGrassTextures(512), []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      tex.color.dispose();
      tex.normal.dispose();
      tex.rough.dispose();
    };
  }, [geometry, tex]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        map={tex.color}
        normalMap={tex.normal}
        normalScale={new THREE.Vector2(0.6, 0.6)}
        roughnessMap={tex.rough}
        roughness={0.9}
        metalness={0}
        color="#ffffff"
        envMapIntensity={0.35}
      />
    </mesh>
  );
}
