/**
 * config.ts — the single source of truth for the BullzEye hero POC.
 *
 * Every camera keyframe (position + target, per beat, for desktop and mobile),
 * every beat's scroll length + easing, and all scan / trajectory / ball
 * appearance + timing defaults live here. The Leva tuning panel (see
 * TuningPanel.tsx) seeds its controls from these values and edits them LIVE;
 * this file holds the defaults so nothing is buried in component code.
 */

export type Vec3 = [number, number, number];

export interface CameraKeyframe {
  /** camera world position */
  pos: Vec3;
  /** point the camera looks at */
  target: Vec3;
}

/** A single narrative beat: a camera framing for desktop + mobile. */
export interface Beat {
  id: number;
  name: string;
  desktop: CameraKeyframe;
  mobile: CameraKeyframe;
  /** relative scroll weight for this beat's segment on the master timeline */
  length: number;
  /** gsap ease used to interpolate INTO this beat */
  ease: string;
}

// ---------------------------------------------------------------------------
// Scene anchors (world units). The green is centered on the origin.
// ---------------------------------------------------------------------------
export const scene = {
  /** golf ball resting spot (xz); y is derived from the ground heightfield */
  ballXZ: [0, 4.2] as [number, number],
  /** cup location (xz); y derived from the ground heightfield */
  holeXZ: [2.6, -4.6] as [number, number],
  ballRadius: 0.18,
  holeRadius: 0.34,
  flagHeight: 3.1,
};

// ---------------------------------------------------------------------------
// Ground / green heightfield shaping. Shared by the green mesh, the scan mesh
// and the trajectory/ball so everything hugs the exact same contours.
// ---------------------------------------------------------------------------
export const green = {
  /** half-extent of the square green in world units (plane is 2*size wide) */
  size: 13,
  /** geometry subdivisions for the photoreal grass plane */
  segments: 150,
  /** subdivisions for the faceted scan overlay (coarser => bigger facets) */
  scanSegments: 46,
  /** master vertical amplitude multiplier for the heightfield */
  heightScale: 1.0,
};

// ---------------------------------------------------------------------------
// Faceted terrain-scan appearance (the hero visual — translucent glass that
// draws as a grid then fills, conforming to the contours). No neon/glow.
// ---------------------------------------------------------------------------
export const scan = {
  /** grid line tint */
  gridColor: "#8a7df0", // soft blue-violet
  /** facet glass tint */
  facetColor: "#aeb6e8", // cool blue/jade-leaning glass
  /** secondary tint mixed on the leading sweep edge */
  edgeColor: "#6ee0d0", // jade highlight on the fill edge
  gridOpacity: 0.55,
  facetOpacity: 0.34,
  /** how reflective/sharp the glass facets read */
  roughness: 0.18,
  /** brightness of the per-facet flat shading */
  facetLightStrength: 0.9,
  /** width of the soft reveal band as the grid/fill sweeps (0..1 of axis) */
  sweepSoftness: 0.12,
};

// ---------------------------------------------------------------------------
// Photoreal grass appearance (procedural turf: albedo tone, tiling, sheen,
// micro-normal). Tuned live from the Leva "Grass" folder.
// ---------------------------------------------------------------------------
export const grass = {
  /** albedo base tone — the hue the whole turf reads as */
  tone: "#45733f",
  /** texture repeat across the plane (lower = larger blades / less obvious grid) */
  tiling: 5.0,
  /** turf sheen strength (meshPhysicalMaterial sheen — the soft grazing glow) */
  sheen: 0.4,
  /** micro-normal relief strength */
  normalStrength: 0.9,
};

// ---------------------------------------------------------------------------
// Image-based lighting. A self-hosted CC0 Poly Haven HDRI drives believable
// ball + glass reflections; a synthetic Lightformer env is the offline fallback.
// ---------------------------------------------------------------------------
export const env = {
  /** shipped HDRI file under /public/hdri (CC0, Poly Haven) */
  file: "/hdri/kloppenheim_06_2k.hdr",
  /** environment intensity on the ball (higher = glossier reflections) */
  ballIntensity: 0.6,
  /** environment intensity on the turf (kept low so grass stays matte) */
  grassIntensity: 0.4,
};

// ---------------------------------------------------------------------------
// Grounding contact shadow (soft baked AO disc) under the ball + flagstick so
// nothing floats. Conforms to the local ground height of each object.
// ---------------------------------------------------------------------------
export const contactShadow = {
  /** darkness of the grounding shadow (0..1) */
  opacity: 0.6,
  /** radius multiple of the ball radius for the ball's shadow disc */
  ballScale: 3.4,
  /** radius (world units) of the flagstick base shadow */
  flagScale: 0.9,
};

// ---------------------------------------------------------------------------
// Post-processing (tasteful, perf-capped). DoF focuses the ball on the macro /
// money beats; gentle thresholded bloom only catches the bright scan/line
// accents; subtle vignette + light grain. Off on mobile + reduced-motion.
// ---------------------------------------------------------------------------
export const post = {
  /** bokeh blur scale for the depth-of-field pass */
  bokehScale: 3.0,
  /** focal region tightness around the ball (smaller = shallower focus) */
  focusRange: 0.012,
  /** bloom strength on the brightest accents only */
  bloomIntensity: 0.7,
  /** luminance threshold so only the scan/line accents bloom (not the scene) */
  bloomThreshold: 0.85,
  /** vignette darkness at the corners */
  vignetteDarkness: 0.62,
  /** film-grain opacity */
  grain: 0.03,
};

// ---------------------------------------------------------------------------
// Illustrative putt trajectory (clearly NOT measured scan data).
// ---------------------------------------------------------------------------
export const trajectory = {
  color: "#53e6ff", // clean cyan-blue
  tipColor: "#eaffff",
  /** lateral break magnitude — how much the line bows sideways */
  breakAmount: 2.1,
  /** small clearance above the surface so the line reads over the grass */
  clearance: 0.07,
  radius: 0.055, // tube thickness
  opacity: 0.95,
};

// ---------------------------------------------------------------------------
// Master timeline tuning (how the single scrubbed GSAP timeline is shaped).
// ---------------------------------------------------------------------------
export const timing = {
  /** total scroll length of the pinned section, in viewport heights */
  scrollVH: 680,
  /** scrub smoothing in seconds (ScrollTrigger scrub value) */
  scrub: 0.6,
  /** grid draw-on duration (timeline seconds, relative) */
  gridDraw: 1.0,
  /** facet fill duration */
  facetFill: 1.0,
  /** trajectory draw-on duration */
  trajectoryDraw: 1.0,
  /** how much the scan recedes during the trajectory beat (0..1 opacity mult) */
  scanRecede: 0.45,
  /** ball roll duration */
  ballRoll: 1.0,
};

// ---------------------------------------------------------------------------
// The six narrative beats. Camera position + target per beat, desktop+mobile.
// (Beat 6 camera is additionally nudged to track the rolling ball in-scene.)
// ---------------------------------------------------------------------------
export const beats: Beat[] = [
  {
    id: 1,
    name: "Macro",
    // Grounded cinematic macro: camera lifted + angled down so the ball sits
    // in the lower-center third, the turf fills the lower ~2/3 of the frame,
    // and the flag reads soft in the distance near the top. (First paint.)
    desktop: { pos: [0.42, 0.98, 5.58], target: [0.18, 0.02, 2.5] },
    mobile: { pos: [0.34, 1.02, 5.42], target: [0.16, 0.02, 2.7] },
    length: 1,
    ease: "none",
  },
  {
    id: 2,
    name: "Aerial reveal",
    desktop: { pos: [-1.5, 7.2, 13.0], target: [0.6, -0.2, 0.2] },
    mobile: { pos: [0.4, 9.5, 15.5], target: [0.8, -0.2, 0.0] },
    length: 1.15,
    ease: "power2.inOut",
  },
  {
    id: 3,
    name: "Terrain scan",
    desktop: { pos: [-3.4, 8.6, 10.5], target: [0.2, -0.3, -1.2] },
    mobile: { pos: [-1.0, 11.0, 13.5], target: [0.4, -0.3, -1.0] },
    length: 1.25,
    ease: "power2.inOut",
  },
  {
    id: 4,
    name: "Trajectory",
    desktop: { pos: [6.6, 4.6, 9.2], target: [1.2, -0.2, -0.6] },
    mobile: { pos: [5.2, 6.4, 12.0], target: [1.4, -0.2, -0.8] },
    length: 1.2,
    ease: "power2.inOut",
  },
  {
    id: 5,
    name: "Camera dive",
    desktop: { pos: [-0.7, 1.05, 6.4], target: [2.6, -0.1, -4.6] },
    mobile: { pos: [-0.6, 1.25, 6.9], target: [2.6, -0.1, -4.6] },
    length: 1.1,
    ease: "power2.inOut",
  },
  {
    id: 6,
    name: "Money shot",
    // Starting framing; during this beat the rig eases toward tracking the ball.
    desktop: { pos: [0.1, 0.9, 5.6], target: [2.6, -0.1, -4.6] },
    mobile: { pos: [0.1, 1.0, 5.9], target: [2.6, -0.1, -4.6] },
    length: 1.35,
    ease: "power1.inOut",
  },
];

// ---------------------------------------------------------------------------
// Scroll-synced copy (placeholder but on-brand; no fabricated metrics).
// side = which edge the block enters from.
// ---------------------------------------------------------------------------
export interface BeatCopy {
  beat: number;
  side: "left" | "right";
  eyebrow: string;
  title: string;
  body: string;
}

export const copy: BeatCopy[] = [
  {
    beat: 1,
    side: "left",
    eyebrow: "BullzEye",
    title: "See the green differently",
    body: "It starts where every putt starts — one ball, one line, and everything you can't see yet.",
  },
  {
    beat: 2,
    side: "left",
    eyebrow: "The read",
    title: "The whole picture",
    body: "Step back and the green reveals its shape — the swells, the fall, the break between you and the cup.",
  },
  {
    beat: 3,
    side: "right",
    eyebrow: "Scan",
    title: "A clearer read",
    body: "Map the surface and the contours come alive — the slope you feel, now something you can see.",
  },
  {
    beat: 4,
    side: "left",
    eyebrow: "The line",
    title: "Trust your line",
    body: "Every break, every roll, resolved into a single confident path from ball to hole.",
  },
  {
    beat: 5,
    side: "right",
    eyebrow: "Commit",
    title: "Down to the blade",
    body: "Get low, settle in, and let the read do the talking. All that's left is the stroke.",
  },
  {
    beat: 6,
    side: "right",
    eyebrow: "Sink it",
    title: "Watch it drop",
    body: "The ball tracks the line you trusted — and finds the bottom of the cup.",
  },
];

/** Default export convenience bundle. */
export const config = { scene, green, grass, env, contactShadow, post, scan, trajectory, timing, beats, copy };
export default config;
