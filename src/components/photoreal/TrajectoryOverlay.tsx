"use client";
import { trajectory, trajGeo } from "@/lib/photoreal";

/**
 * TrajectoryOverlay — a clean curved putt line from the ball toward the cup in
 * beat_4's framing (SVG cubic path on a 1920x1080 viewBox). The line DRAWS ON
 * via stroke-dashoffset scrubbed by GSAP (`[data-pr-traj-path]`), thin and in
 * the exact config `trajectory.color` cyan. A small ball-dot
 * (`[data-pr-traj-dot]`) travels the path as beats 5→6 approach.
 *
 * `resolved` renders the line fully drawn (dashoffset 0) for the static /
 * reduced-motion path.
 */
export function TrajectoryOverlay({ resolved = false }: { resolved?: boolean }) {
  const { viewW, viewH, ball, c1, c2, hole, ballR, holeR } = trajGeo;
  const d = `M ${ball.x} ${ball.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${hole.x} ${hole.y}`;

  // A generous dash length guarantees full coverage before we know pathLength;
  // GSAP overrides the exact values from the measured length on mount.
  const dash = 2600;

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <filter id="pr-traj-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* cup target ring */}
      <circle
        cx={hole.x}
        cy={hole.y}
        r={holeR}
        fill="none"
        stroke={trajectory.tipColor}
        strokeWidth={2.5}
        strokeOpacity={resolved ? 0.9 : 0}
        data-pr-traj-hole
      />

      {/* the putt line */}
      <path
        data-pr-traj-path
        d={d}
        fill="none"
        stroke={trajectory.color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeOpacity={trajectory.opacity}
        filter="url(#pr-traj-glow)"
        strokeDasharray={dash}
        strokeDashoffset={resolved ? 0 : dash}
      />

      {/* traveling ball-dot (parked at the ball until beats 5→6) */}
      <circle
        data-pr-traj-dot
        cx={resolved ? hole.x : ball.x}
        cy={resolved ? hole.y : ball.y}
        r={ballR}
        fill={trajectory.tipColor}
        style={{ opacity: resolved ? 0 : 0 }}
      />
    </svg>
  );
}
