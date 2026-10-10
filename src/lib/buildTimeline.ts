/**
 * buildTimeline.ts — constructs the ONE GSAP timeline that the scroll position
 * scrubs. Camera, scan grid/fill, trajectory draw, ball roll and the HTML copy
 * are ALL tweens on this single timeline, so scrubbing forward and backward is
 * coherent and deterministic. Driven values are written onto the shared anim
 * proxy (read in useFrame); text is tweened directly on the DOM elements.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { AnimState } from "./animState";
import type { TunedConfig } from "./tuning";
import { copy } from "./config";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export interface BuildArgs {
  anim: AnimState;
  cfg: TunedConfig;
  triggerEl: HTMLElement;
  overlayEl: HTMLElement;
}

const sideOf = (beat: number) => copy.find((c) => c.beat === beat)?.side ?? "left";
const enterX = (beat: number) => (sideOf(beat) === "right" ? 64 : -64);

export function buildScrollTimeline({ anim, cfg, triggerEl, overlayEl }: BuildArgs): gsap.core.Timeline {
  const b = cfg.beats;
  const t = cfg.timing;
  const q = (beat: number) => overlayEl.querySelector<HTMLElement>(`[data-beat="${beat}"]`);

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: triggerEl,
      start: "top top",
      end: "bottom bottom",
      scrub: t.scrub,
      invalidateOnRefresh: true,
    },
  });

  // --- initial state (beat 1) -------------------------------------------------
  tl.set(anim, {
    camX: b[0].pos[0], camY: b[0].pos[1], camZ: b[0].pos[2],
    tgtX: b[0].target[0], tgtY: b[0].target[1], tgtZ: b[0].target[2],
    gridDraw: 0, facetFill: 0, scanOpacity: 1,
    trajectoryDraw: 0, ballRoll: 0, followBlend: 0, progress: 0,
  });
  copy.forEach((c) => {
    const el = q(c.beat);
    if (el) gsap.set(el, { opacity: c.beat === 1 ? 1 : 0, x: c.beat === 1 ? 0 : enterX(c.beat) });
  });

  const camTo = (i: number, label: string) => {
    tl.addLabel(label);
    tl.to(
      anim,
      {
        camX: b[i].pos[0], camY: b[i].pos[1], camZ: b[i].pos[2],
        tgtX: b[i].target[0], tgtY: b[i].target[1], tgtZ: b[i].target[2],
        duration: b[i].length,
        ease: b[i].ease,
      },
      label
    );
  };
  const textOut = (beat: number, at: string) => {
    const el = q(beat);
    if (el) tl.to(el, { opacity: 0, x: enterX(beat) * 0.5, duration: 0.35 }, at);
  };
  const textIn = (beat: number, at: string) => {
    const el = q(beat);
    if (el) tl.fromTo(el, { opacity: 0, x: enterX(beat) }, { opacity: 1, x: 0, duration: 0.5 }, at);
  };

  // --- beat 1 -> 2 : aerial reveal -------------------------------------------
  camTo(1, "b1");
  textOut(1, "b1");
  textIn(2, "b1+=0.3");

  // --- beat 2 -> 3 : terrain scan (grid draws, then facets fill) -------------
  camTo(2, "b2");
  textOut(2, "b2");
  textIn(3, "b2+=0.3");
  tl.to(anim, { gridDraw: 1, duration: t.gridDraw }, "b2");
  tl.to(anim, { facetFill: 1, duration: t.facetFill }, `b2+=${(t.gridDraw * 0.6).toFixed(3)}`);

  // --- beat 3 -> 4 : trajectory draws, scan recedes --------------------------
  camTo(3, "b3");
  textOut(3, "b3");
  textIn(4, "b3+=0.3");
  tl.to(anim, { scanOpacity: t.scanRecede, duration: 0.6 }, "b3");
  tl.to(anim, { trajectoryDraw: 1, duration: t.trajectoryDraw, ease: "power1.out" }, "b3+=0.25");

  // --- beat 4 -> 5 : camera dive ---------------------------------------------
  camTo(4, "b4");
  textOut(4, "b4");
  textIn(5, "b4+=0.3");
  tl.to(anim, { scanOpacity: Math.min(t.scanRecede, 0.15), duration: 0.6 }, "b4");

  // --- beat 5 -> 6 : money shot (ball rolls, camera tracks) ------------------
  camTo(5, "b5");
  textOut(5, "b5");
  tl.to(anim, { followBlend: 1, duration: 0.5 }, "b5");
  tl.to(anim, { ballRoll: 1, duration: t.ballRoll, ease: "power1.inOut" }, "b5+=0.25");
  textIn(6, `b5+=${(0.25 + t.ballRoll * 0.55).toFixed(3)}`);

  return tl;
}
