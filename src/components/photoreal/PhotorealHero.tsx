"use client";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { copy } from "@/lib/config";
import { photorealBeats, prTiming, scan, scanGeo } from "@/lib/photoreal";
import { ScanOverlay } from "./ScanOverlay";
import { TrajectoryOverlay } from "./TrajectoryOverlay";
import { PhotorealCopy } from "./PhotorealCopy";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const sideOf = (beat: number) => copy.find((c) => c.beat === beat)?.side ?? "left";
const enterX = (beat: number) => (sideOf(beat) === "right" ? 56 : -56);

/**
 * PhotorealHero — the /photoreal prototype. Six pre-rendered Blender plates,
 * layered and cross-dissolved by a single scrubbed GSAP ScrollTrigger timeline,
 * each with a subtle Ken-Burns push-in, plus the scan (beat 3) and trajectory
 * (beat 4) overlays drawing on with scroll. CSS-sticky stage over a tall
 * scroll container — the same pin/scrub mechanism the real-time hero at `/`
 * uses, so forward and reverse scrubbing feel identical.
 */
export function PhotorealHero() {
  const pinRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);

  // reduced-motion detection (+ ?rm=1 test override), client-only.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const forceRM = new URLSearchParams(window.location.search).get("rm") === "1";
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(forceRM || mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Build the single scrubbed timeline (motion path only).
  useEffect(() => {
    if (!mounted || reducedMotion || !pinRef.current || !stageRef.current) return;
    const stage = stageRef.current;
    const q = <T extends Element = HTMLElement>(sel: string) => stage.querySelector<T>(sel);
    const beats = photorealBeats;
    const HOLD = prTiming.hold;
    const TRANS = prTiming.trans;

    const ctx = gsap.context(() => {
      const layers = beats.map((b) => q(`[data-pr-layer="${b.n}"]`)!);
      const kbs = beats.map((b) => q(`[data-pr-kb="${b.n}"]`)!);
      const copies = beats.map((b) => q(`[data-pr-copy="${b.n}"]`)!);

      // --- initial state ----------------------------------------------------
      layers.forEach((el, i) => gsap.set(el, { opacity: i === 0 ? 1 : 0 }));
      beats.forEach((b, i) =>
        gsap.set(kbs[i], {
          scale: b.kenBurns.from.scale,
          xPercent: b.kenBurns.from.xPercent,
          yPercent: b.kenBurns.from.yPercent,
          transformOrigin: "50% 50%",
        })
      );
      copies.forEach((el, i) => gsap.set(el, { opacity: i === 0 ? 1 : 0, x: i === 0 ? 0 : enterX(beats[i].n) }));

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: pinRef.current!,
          start: "top top",
          end: "bottom bottom",
          scrub: prTiming.scrub,
          invalidateOnRefresh: true,
        },
      });

      const kbTo = (i: number, at: number) => {
        const b = beats[i];
        tl.to(
          kbs[i],
          { scale: b.kenBurns.to.scale, xPercent: b.kenBurns.to.xPercent, yPercent: b.kenBurns.to.yPercent, duration: HOLD + TRANS },
          at
        );
      };

      // beat 1 (already visible): ken-burns from 0, copy out at end of hold
      kbTo(0, 0);
      tl.to(copies[0], { opacity: 0, x: enterX(beats[0].n) * 0.5, duration: TRANS * 0.7, ease: "power2.in" }, HOLD - TRANS / 2);

      // beats 2..6
      for (let i = 1; i < beats.length; i++) {
        const p = i * HOLD;
        const enter = p - TRANS / 2;
        tl.to(layers[i], { opacity: 1, duration: TRANS, ease: "power1.inOut" }, enter);
        kbTo(i, enter);
        tl.fromTo(
          copies[i],
          { opacity: 0, x: enterX(beats[i].n) },
          { opacity: 1, x: 0, duration: TRANS, ease: "power2.out" },
          p - TRANS / 4
        );
        if (i < beats.length - 1) {
          tl.to(copies[i], { opacity: 0, x: enterX(beats[i].n) * 0.5, duration: TRANS * 0.7, ease: "power2.in" }, p + HOLD - TRANS / 2);
        }
      }

      // --- SCAN overlay (beat 3, index 2) -----------------------------------
      const scanStart = 2 * HOLD - TRANS / 2 + 0.15;
      const wipe = q<SVGRectElement>("[data-pr-scan-wipe]");
      const facets = q<SVGGElement>("[data-pr-scan-facets]");
      if (wipe) tl.fromTo(wipe, { attr: { width: 0 } }, { attr: { width: scanGeo.viewW }, duration: HOLD * 0.8 }, scanStart);
      if (facets) tl.fromTo(facets, { opacity: 0 }, { opacity: scan.facetOpacity, duration: HOLD * 0.7, ease: "power1.out" }, scanStart + 0.18);

      // --- TRAJECTORY overlay (beat 4, index 3) -----------------------------
      const trajStart = 3 * HOLD - TRANS / 2 + 0.15;
      const path = q<SVGPathElement>("[data-pr-traj-path]");
      const hole = q<SVGCircleElement>("[data-pr-traj-hole]");
      const dot = q<SVGCircleElement>("[data-pr-traj-dot]");
      if (path) {
        const len = path.getTotalLength();
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
        tl.to(path, { strokeDashoffset: 0, duration: HOLD * 0.85, ease: "power1.out" }, trajStart);
        if (hole) tl.fromTo(hole, { opacity: 0 }, { opacity: 0.9, duration: TRANS }, trajStart + HOLD * 0.45);
        if (dot) {
          const prox = { p: 0 };
          const dotStart = trajStart + HOLD * 0.42;
          tl.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: TRANS * 0.6 }, dotStart);
          tl.to(
            prox,
            {
              p: 1,
              duration: HOLD * 0.55,
              onUpdate: () => {
                const pt = path.getPointAtLength(prox.p * len);
                gsap.set(dot, { attr: { cx: pt.x, cy: pt.y } });
              },
            },
            dotStart
          );
          tl.to(dot, { opacity: 0, duration: TRANS * 0.6 }, dotStart + HOLD * 0.55);
        }
      }

      // settle after fonts/layout
      ScrollTrigger.refresh();
    }, stage);

    const onResize = () => ScrollTrigger.refresh();
    window.addEventListener("resize", onResize);
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 80);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(id);
      ctx.revert();
    };
  }, [mounted, reducedMotion]);

  // ---------------------------------------------------------------------------
  // Reduced-motion / static: a tasteful stacked, sectioned version. No
  // scroll-jack; overlays shown in their resolved end-state.
  // ---------------------------------------------------------------------------
  if (mounted && reducedMotion) {
    return (
      <div className="relative w-full bg-[#05070a]">
        <div className="pointer-events-none fixed left-6 top-6 z-30 sm:left-10 sm:top-8">
          <span className="text-sm font-semibold tracking-[0.3em] text-white/90">BULLZEYE</span>
        </div>
        {photorealBeats.map((b) => {
          const c = copy.find((x) => x.beat === b.n)!;
          return (
            <section key={b.n} className="relative flex min-h-[100svh] w-full items-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.src}
                alt={b.alt}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: b.focal }}
                loading={b.n === 1 ? "eager" : "lazy"}
              />
              {b.n === 3 && <ScanOverlay resolved />}
              {b.n === 4 && <TrajectoryOverlay resolved />}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/55" />
              <div className={`relative z-10 w-full px-6 sm:px-16 ${c.side === "right" ? "text-right" : "text-left"}`}>
                <div className={`w-[min(86vw,30rem)] ${c.side === "right" ? "ml-auto" : ""}`}>
                  <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#9b8ff5] sm:text-xs">{c.eyebrow}</p>
                  <h2 className="mb-3 text-balance text-3xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">{c.title}</h2>
                  <p className="text-pretty text-sm leading-relaxed text-white/80 sm:text-lg">{c.body}</p>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Motion path: pinned stage + tall scroll container.
  // ---------------------------------------------------------------------------
  return (
    <section
      ref={pinRef}
      className="relative w-full"
      style={{ height: `${prTiming.scrollVH}vh` }}
      aria-label="BullzEye photoreal green-reading hero"
    >
      <div ref={stageRef} className="sticky top-0 h-[100svh] w-full overflow-hidden bg-[#05070a]">
        {/* plate layers */}
        {photorealBeats.map((b) => (
          <div key={b.n} data-pr-layer={b.n} className="absolute inset-0" style={{ zIndex: b.n, opacity: b.n === 1 ? 1 : 0 }}>
            <div data-pr-kb={b.n} className="absolute inset-0 will-change-transform">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.src}
                alt={b.alt}
                className="absolute inset-0 h-full w-full object-cover"
                style={{ objectPosition: b.focal }}
                draggable={false}
                fetchPriority={b.n === 1 ? "high" : "auto"}
                loading="eager"
                decoding="async"
              />
              {b.n === 3 && <ScanOverlay />}
              {b.n === 4 && <TrajectoryOverlay />}
            </div>
          </div>
        ))}

        {/* legibility vignette under the copy */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/45"
          style={{ zIndex: 20 }}
        />

        {/* scroll-synced copy */}
        <div className="absolute inset-0" style={{ zIndex: 30 }}>
          <PhotorealCopy reducedMotion={false} />
        </div>

        {/* brand mark */}
        <div className="pointer-events-none absolute left-6 top-6 sm:left-10 sm:top-8" style={{ zIndex: 40 }}>
          <span className="text-sm font-semibold tracking-[0.3em] text-white/90">BULLZEYE</span>
        </div>

        {/* scroll hint */}
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-center" style={{ zIndex: 40 }}>
          <span className="text-[0.65rem] uppercase tracking-[0.3em] text-white/50">Scroll</span>
          <div className="mx-auto mt-2 h-8 w-px animate-pulse bg-gradient-to-b from-white/60 to-transparent" />
        </div>
      </div>
    </section>
  );
}
