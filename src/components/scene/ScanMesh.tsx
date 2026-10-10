"use client";
import { useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAnim } from "./AnimContext";
import { green } from "@/lib/config";
import { groundHeight } from "@/lib/heightfield";

export interface ScanAppearance {
  gridColor: string;
  facetColor: string;
  edgeColor: string;
  gridOpacity: number;
  facetOpacity: number;
  facetLightStrength: number;
  sweepSoftness: number;
}

const KEY_LIGHT_DIR = new THREE.Vector3(5, 9, 3).normalize();

/** normalized reveal coordinate: 0 at the near (ball-side +z) edge -> 1 far */
function sweepCoord(z: number): number {
  const s = (green.size - z) / (green.size * 2);
  return THREE.MathUtils.clamp(s, 0, 1);
}

/**
 * The faceted terrain-scan overlay. Conforms to the SAME heightfield as the
 * green. First DRAWS as a grid (lines sweep on), then FILLS with translucent,
 * flat-faceted glass. Refined blue/violet/jade glass look — no neon/outer glow.
 */
export function ScanMesh({ appearance }: { appearance: ScanAppearance }) {
  const anim = useAnim();

  // --- faceted fill geometry: displaced plane, made NON-INDEXED so
  // computeVertexNormals() yields true per-face (flat) normals => faceted glass,
  // with a per-vertex sweep attribute for the reveal. No shader derivatives.
  const fillGeo = useMemo(() => {
    const W = green.size * 2;
    const base = new THREE.PlaneGeometry(W, W, green.scanSegments, green.scanSegments);
    base.rotateX(-Math.PI / 2);
    const bpos = base.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bpos.count; i++) {
      const x = bpos.getX(i);
      const z = bpos.getZ(i);
      bpos.setY(i, groundHeight(x, z) + 0.03); // hover just over the grass
    }
    bpos.needsUpdate = true;
    const g = base.toNonIndexed();
    base.dispose();
    g.computeVertexNormals(); // flat normals (vertices no longer shared)
    const pos = g.attributes.position as THREE.BufferAttribute;
    const sweep = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) sweep[i] = sweepCoord(pos.getZ(i));
    g.setAttribute("aSweep", new THREE.BufferAttribute(sweep, 1));
    return g;
  }, []);

  // --- grid line geometry (wireframe of the same surface + sweep attr)
  const gridGeo = useMemo(() => {
    const wire = new THREE.WireframeGeometry(fillGeo);
    const pos = wire.attributes.position as THREE.BufferAttribute;
    const sweep = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) sweep[i] = sweepCoord(pos.getZ(i));
    wire.setAttribute("aSweep", new THREE.BufferAttribute(sweep, 1));
    return wire;
  }, [fillGeo]);

  const fillUniforms = useMemo(
    () => ({
      uFill: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(appearance.facetColor) },
      uEdgeColor: { value: new THREE.Color(appearance.edgeColor) },
      uSoft: { value: appearance.sweepSoftness },
      uLightStrength: { value: appearance.facetLightStrength },
      uLightDir: { value: KEY_LIGHT_DIR },
    }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const gridUniforms = useMemo(
    () => ({
      uDraw: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(appearance.gridColor) },
      uSoft: { value: appearance.sweepSoftness },
    }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Build materials imperatively so the uniforms object wires by reference
  // (passing `uniforms` as a JSX prop lets R3F recurse into the Color/Vector
  // values and detach them, leaving the shader reading zeros).
  const fillMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: fillUniforms,
        vertexShader: FILL_VERT,
        fragmentShader: FILL_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [fillUniforms]
  );
  const gridMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: gridUniforms,
        vertexShader: GRID_VERT,
        fragmentShader: GRID_FRAG,
        transparent: true,
        depthWrite: false,
      }),
    [gridUniforms]
  );

  useEffect(() => {
    return () => {
      fillGeo.dispose();
      gridGeo.dispose();
      fillMaterial.dispose();
      gridMaterial.dispose();
    };
  }, [fillGeo, gridGeo, fillMaterial, gridMaterial]);

  useFrame(() => {
    // live values from the scrubbed timeline
    gridUniforms.uDraw.value = anim.gridDraw;
    gridUniforms.uOpacity.value = appearance.gridOpacity * anim.scanOpacity;
    fillUniforms.uFill.value = anim.facetFill;
    fillUniforms.uOpacity.value = appearance.facetOpacity * anim.scanOpacity;
    // live appearance edits from Leva
    fillUniforms.uColor.value.set(appearance.facetColor);
    fillUniforms.uEdgeColor.value.set(appearance.edgeColor);
    fillUniforms.uSoft.value = appearance.sweepSoftness;
    fillUniforms.uLightStrength.value = appearance.facetLightStrength;
    gridUniforms.uColor.value.set(appearance.gridColor);
    gridUniforms.uSoft.value = appearance.sweepSoftness;
  });

  return (
    <group>
      {/* translucent faceted glass fill */}
      <mesh geometry={fillGeo} material={fillMaterial} />
      {/* grid lines that draw on first */}
      <lineSegments geometry={gridGeo} material={gridMaterial} />
    </group>
  );
}

const FILL_VERT = /* glsl */ `
  attribute float aSweep;
  varying float vSweep;
  varying vec3 vViewDir;
  varying vec3 vWorldNormal;
  void main(){
    vSweep = aSweep;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - wp.xyz);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FILL_FRAG = /* glsl */ `
  precision highp float;
  uniform float uFill;
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform vec3 uEdgeColor;
  uniform float uSoft;
  uniform float uLightStrength;
  uniform vec3 uLightDir;
  varying float vSweep;
  varying vec3 vViewDir;
  varying vec3 vWorldNormal;

  void main(){
    // reveal facets up to the fill sweep
    float reveal = 1.0 - smoothstep(uFill - uSoft, uFill, vSweep);
    if (reveal <= 0.001) discard;

    // flat per-face normal (geometry is non-indexed) -> faceted shading
    vec3 n = normalize(vWorldNormal);
    vec3 viewDir = normalize(vViewDir);
    if (dot(n, viewDir) < 0.0) n = -n;

    float diff = max(dot(n, normalize(uLightDir)), 0.0);
    float shade = 0.4 + diff * uLightStrength;
    // glassy fresnel rim (subtle, no bloom)
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);

    // leading sweep edge highlight
    float edge = smoothstep(uFill - uSoft, uFill, vSweep);

    vec3 col = uColor * shade;
    col += uEdgeColor * edge * 0.9;
    col += vec3(0.9, 0.95, 1.0) * fres * 0.3;

    float alpha = uOpacity * reveal + edge * 0.2 + fres * 0.1;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

const GRID_VERT = /* glsl */ `
  attribute float aSweep;
  varying float vSweep;
  void main(){
    vSweep = aSweep;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GRID_FRAG = /* glsl */ `
  precision highp float;
  uniform float uDraw;
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform float uSoft;
  varying float vSweep;
  void main(){
    float reveal = 1.0 - smoothstep(uDraw - uSoft, uDraw, vSweep);
    if (reveal <= 0.001) discard;
    float edge = smoothstep(uDraw - uSoft, uDraw, vSweep);
    vec3 col = uColor + vec3(0.25) * edge; // brighter at the drawing edge
    gl_FragColor = vec4(col, uOpacity * reveal + edge * 0.3);
  }
`;
