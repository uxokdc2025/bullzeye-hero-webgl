/**
 * photoreal.ts — data for the /photoreal prototype (pre-rendered Blender plates).
 *
 * This route proves "photoreal + scroll" WITHOUT the real-time WebGL scene: six
 * pre-rendered 1920x1080 stills of one continuous golden-hour golf environment,
 * cross-dissolved + Ken-Burns-pushed as the user scrolls a single scrubbed GSAP
 * timeline. Narrative copy is reused verbatim from `config.ts` (the `copy`
 * array) so both heroes tell the identical story.
 *
 * Nothing here touches the real-time hero at `/`.
 */
import { copy, scan, trajectory } from "./config";

export { scan, trajectory };

/** Ken-Burns push-in for one plate: start/end scale + translate (percent). */
export interface KenBurns {
  from: { scale: number; xPercent: number; yPercent: number };
  to: { scale: number; xPercent: number; yPercent: number };
}

export interface PhotorealBeat {
  /** 1-based beat index (matches config.ts copy[].beat) */
  n: number;
  /** optimized plate (webp) + original png fallback live beside it */
  src: string;
  /** short alt describing the framing */
  alt: string;
  /** object-position focal point so the subject holds frame at 390px */
  focal: string;
  /** subtle cinematic push-in across this plate's visible window */
  kenBurns: KenBurns;
}

/**
 * The six plates. One continuous environment, six narrative angles:
 * 1 macro · 2 aerial reveal · 3 terrain read (carries SCAN) ·
 * 4 the line (carries TRAJECTORY) · 5 dive · 6 money shot.
 */
export const photorealBeats: PhotorealBeat[] = [
  {
    n: 1,
    src: "/photoreal/beat_1.webp",
    alt: "Macro view: a golf ball resting on the turf, the flag soft in the distance.",
    focal: "50% 62%",
    kenBurns: { from: { scale: 1.0, xPercent: 0, yPercent: 1 }, to: { scale: 1.06, xPercent: -1, yPercent: -2 } },
  },
  {
    n: 2,
    src: "/photoreal/beat_2.webp",
    alt: "Aerial reveal: the whole green, flag and horizon at golden hour.",
    focal: "50% 42%",
    kenBurns: { from: { scale: 1.05, xPercent: 0, yPercent: -1 }, to: { scale: 1.0, xPercent: 0, yPercent: 1 } },
  },
  {
    n: 3,
    src: "/photoreal/beat_3.webp",
    alt: "Terrain read: a low raking angle across the contours of the green.",
    focal: "50% 54%",
    kenBurns: { from: { scale: 1.0, xPercent: -1, yPercent: 0 }, to: { scale: 1.05, xPercent: 1, yPercent: 0 } },
  },
  {
    n: 4,
    src: "/photoreal/beat_4.webp",
    alt: "The line: the ball framed with the hole, the putt line between them.",
    focal: "50% 55%",
    kenBurns: { from: { scale: 1.0, xPercent: 1, yPercent: 0 }, to: { scale: 1.05, xPercent: -1, yPercent: -1 } },
  },
  {
    n: 5,
    src: "/photoreal/beat_5.webp",
    alt: "Dive: low behind the ball, looking down the line toward the hole.",
    focal: "50% 56%",
    kenBurns: { from: { scale: 1.0, xPercent: 0, yPercent: 1 }, to: { scale: 1.07, xPercent: 0, yPercent: -2 } },
  },
  {
    n: 6,
    src: "/photoreal/beat_6.webp",
    alt: "Money shot: the ball at the very lip of the cup.",
    focal: "50% 58%",
    kenBurns: { from: { scale: 1.04, xPercent: 0, yPercent: 0 }, to: { scale: 1.1, xPercent: 0, yPercent: -1 } },
  },
];

/** Timeline shape (mirrors the feel of the real-time hero's scrub). */
export const prTiming = {
  /** total scroll length of the pinned section, in viewport heights */
  scrollVH: 620,
  /** ScrollTrigger scrub smoothing (seconds) — same feel as `/` */
  scrub: 0.6,
  /** per-beat hold on the normalized timeline */
  hold: 1,
  /** crossfade length between adjacent beats (timeline units) */
  trans: 0.55,
};

/**
 * SCAN overlay geometry (beat 3). A faceted contour grid drawn in SVG user
 * units over a 1920x1080 viewBox, positioned over the green surface band of
 * beat_3. Built as a perspective trapezoid mesh (near edge wider than far).
 * Tints come from config `scan`.
 */
export const scanGeo = {
  viewW: 1920,
  viewH: 1080,
  /** trapezoid covering the green surface in beat_3's framing */
  farY: 430, // top (far) edge
  nearY: 1010, // bottom (near) edge
  farHalf: 300, // half-width of far edge
  nearHalf: 900, // half-width of near edge
  cx: 960, // horizontal center
  cols: 9,
  rows: 6,
};

/**
 * TRAJECTORY overlay geometry (beat 4). A single curved putt line from the ball
 * toward the cup in beat_4's framing, as a cubic SVG path on the same 1920x1080
 * viewBox. Calibrated against the plate; tweak if the plate reframes.
 */
export const trajGeo = {
  viewW: 1920,
  viewH: 1080,
  /** putt origin — foreground, nearest the camera (bottom of frame) */
  ball: { x: 820, y: 1055 },
  /** cubic control points — a gentle rightward break up the slope */
  c1: { x: 690, y: 905 },
  c2: { x: 1015, y: 715 },
  /** destination — the base of the ball / lip of the cup in beat_4's framing */
  hole: { x: 934, y: 588 },
  ballR: 13,
  holeR: 17,
};
