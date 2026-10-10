"use client";
import { scan, scanGeo } from "@/lib/photoreal";

/**
 * ScanOverlay — a lightweight 2D (SVG) analogue of the real-time ScanMesh.
 *
 * A faceted contour grid laid over the green surface band of beat_3, built as a
 * perspective trapezoid mesh (near edge wide, far edge narrow). It reads as if
 * it is mapping the slope. The grid LINES draw on left→right via a clip-path
 * rect whose width is scrubbed by GSAP (`[data-pr-scan-wipe]`); the translucent
 * FACETS fade in just behind the leading edge (`[data-pr-scan-facets]`). Tints
 * are the exact config `scan` colors — translucent, no neon.
 *
 * `resolved` renders the settled end-state (full grid + facets) for the
 * reduced-motion / static path.
 */
export function ScanOverlay({ resolved = false }: { resolved?: boolean }) {
  const { viewW, viewH, farY, nearY, farHalf, nearHalf, cx, cols, rows } = scanGeo;

  // Perspective lerp: t=0 far (narrow), t=1 near (wide).
  const yAt = (t: number) => farY + (nearY - farY) * t;
  const halfAt = (t: number) => farHalf + (nearHalf - farHalf) * t;
  const xAt = (t: number, u: number) => cx + (u - 0.5) * 2 * halfAt(t);

  // Build facet quads (one <polygon> per cell) + grid polylines.
  const facets: { pts: string; key: string }[] = [];
  const hLines: { pts: string; key: string }[] = [];
  const vLines: { pts: string; key: string }[] = [];

  for (let r = 0; r < rows; r++) {
    const t0 = r / rows;
    const t1 = (r + 1) / rows;
    for (let c = 0; c < cols; c++) {
      const u0 = c / cols;
      const u1 = (c + 1) / cols;
      const p0 = `${xAt(t0, u0).toFixed(1)},${yAt(t0).toFixed(1)}`;
      const p1 = `${xAt(t0, u1).toFixed(1)},${yAt(t0).toFixed(1)}`;
      const p2 = `${xAt(t1, u1).toFixed(1)},${yAt(t1).toFixed(1)}`;
      const p3 = `${xAt(t1, u0).toFixed(1)},${yAt(t1).toFixed(1)}`;
      facets.push({ pts: `${p0} ${p1} ${p2} ${p3}`, key: `f${r}-${c}` });
    }
  }
  // Horizontal contour lines (constant row), across full width.
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const pts = Array.from({ length: cols + 1 }, (_, c) => `${xAt(t, c / cols).toFixed(1)},${yAt(t).toFixed(1)}`).join(" ");
    hLines.push({ pts, key: `h${r}` });
  }
  // Vertical lines (constant column), far→near.
  for (let c = 0; c <= cols; c++) {
    const u = c / cols;
    const pts = Array.from({ length: rows + 1 }, (_, r) => `${xAt(r / rows, u).toFixed(1)},${yAt(r / rows).toFixed(1)}`).join(" ");
    vLines.push({ pts, key: `v${c}` });
  }

  const wipeW = resolved ? viewW : 0;
  const facetOpacity = resolved ? scan.facetOpacity : 0;

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <clipPath id="pr-scan-clip">
          <rect data-pr-scan-wipe x="0" y="0" width={wipeW} height={viewH} />
        </clipPath>
        <linearGradient id="pr-scan-edge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={scan.facetColor} stopOpacity="0" />
          <stop offset="85%" stopColor={scan.facetColor} stopOpacity="0" />
          <stop offset="100%" stopColor={scan.edgeColor} stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <g clipPath="url(#pr-scan-clip)">
        {/* translucent glass facets (fade in behind the leading edge) */}
        <g data-pr-scan-facets style={{ opacity: facetOpacity }}>
          {facets.map((f) => (
            <polygon
              key={f.key}
              points={f.pts}
              fill={scan.facetColor}
              fillOpacity={0.14}
              stroke="none"
            />
          ))}
        </g>
        {/* contour grid lines */}
        <g
          fill="none"
          stroke={scan.gridColor}
          strokeWidth={2}
          strokeOpacity={scan.gridOpacity}
          strokeLinejoin="round"
        >
          {hLines.map((l) => (
            <polyline key={l.key} points={l.pts} />
          ))}
          {vLines.map((l) => (
            <polyline key={l.key} points={l.pts} strokeOpacity={scan.gridOpacity * 0.65} />
          ))}
        </g>
        {/* soft jade sweep tint on the leading edge */}
        <rect x="0" y={farY} width={viewW} height={nearY - farY} fill="url(#pr-scan-edge)" />
      </g>
    </svg>
  );
}
