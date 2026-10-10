"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Leva } from "leva";
import { createAnimState } from "@/lib/animState";
import { buildScrollTimeline } from "@/lib/buildTimeline";
import type { TunedConfig } from "@/lib/tuning";
import { TuningProvider } from "./TuningProvider";
import { TextOverlay } from "./TextOverlay";

// Canvas is client-only (WebGL): load with ssr:false from inside this client component.
const Scene = dynamic(() => import("./scene/Scene").then((m) => m.Scene), { ssr: false });

export function Hero() {
  // Stable, create-once mutable proxy that GSAP tweens and the scene reads.
  const anim = useMemo(() => createAnimState(), []);
  const pinRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const [cfg, setCfg] = useState<TunedConfig | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  // viewport composition + reduced-motion + ?tune detection
  useEffect(() => {
    // Gate client-only Leva / matchMedia detection until after mount so they
    // never run during SSR/prerender (intentional mount flag).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    const params0 = new URLSearchParams(window.location.search);
    const forceRM = params0.get("rm") === "1"; // testing/preview override
    const mqMobile = window.matchMedia("(max-width: 767px)");
    const mqRM = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMobile = () => setIsMobile(mqMobile.matches);
    const applyRM = () => setReducedMotion(forceRM || mqRM.matches);
    applyMobile();
    applyRM();
    mqMobile.addEventListener("change", applyMobile);
    mqRM.addEventListener("change", applyRM);

    const params = new URLSearchParams(window.location.search);
    if (params.get("tune") === "1") setShowPanel(true);

    return () => {
      mqMobile.removeEventListener("change", applyMobile);
      mqRM.removeEventListener("change", applyRM);
    };
  }, []);

  const onCfg = useCallback((c: TunedConfig) => setCfg(c), []);

  // R3F's initial ResizeObserver can miss the first measure in some embedding
  // contexts (canvas stuck at 300x150); nudge a remeasure once the scene mounts.
  useEffect(() => {
    if (!cfg) return;
    const ids = [120, 400, 900].map((d) =>
      window.setTimeout(() => window.dispatchEvent(new Event("resize")), d)
    );
    return () => ids.forEach(clearTimeout);
  }, [cfg]);

  // Build / rebuild the single scrubbed timeline whenever config or mode changes.
  useEffect(() => {
    if (!cfg || !pinRef.current || !overlayRef.current) return;

    if (reducedMotion) {
      // Composed static frame that still tells the story (scan filled + line drawn).
      const k = cfg.beats[2]; // terrain-scan framing
      Object.assign(anim, {
        camX: k.pos[0], camY: k.pos[1], camZ: k.pos[2],
        tgtX: k.target[0], tgtY: k.target[1], tgtZ: k.target[2],
        gridDraw: 1, facetFill: 1, scanOpacity: 0.85,
        trajectoryDraw: 1, ballRoll: 0, followBlend: 0, progress: 0.4,
      });
      return;
    }

    const tl = buildScrollTimeline({
      anim,
      cfg,
      triggerEl: pinRef.current,
      overlayEl: overlayRef.current,
    });
    tlRef.current = tl;

    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => tl.scrollTrigger?.refresh());
    };
    window.addEventListener("resize", onResize);
    // settle after fonts/layout
    const refreshId = window.setTimeout(() => tl.scrollTrigger?.refresh(), 60);

    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(refreshId);
      cancelAnimationFrame(raf);
      tl.scrollTrigger?.kill();
      tl.kill();
      tlRef.current = null;
    };
  }, [cfg, reducedMotion, isMobile, anim]);

  return (
    <>
      {/* Leva panel — hidden unless ?tune=1 or toggled. config.ts holds the defaults. */}
      <Leva hidden={!showPanel} oneLineLabels />
      {ready && <TuningProvider key={isMobile ? "m" : "d"} isMobile={isMobile} onChange={onCfg} />}

      <section
        ref={pinRef}
        className="relative w-full"
        style={{ height: reducedMotion ? "100vh" : `${cfg?.timing.scrollVH ?? 680}vh` }}
        aria-label="BullzEye green-reading hero"
      >
        <div className="sticky top-0 h-[100svh] w-full overflow-hidden bg-[#05070a]">
          {cfg && (
            <Scene
              anim={anim}
              fov={cfg.fov}
              scanAppearance={cfg.scan}
              trajectoryAppearance={cfg.trajectory}
              reducedMotion={reducedMotion}
            />
          )}

          {/* scroll-synced copy */}
          <div ref={overlayRef} className="absolute inset-0">
            <TextOverlay reducedMotion={reducedMotion} />
          </div>

          {/* brand mark */}
          <div className="pointer-events-none absolute left-6 top-6 z-10 sm:left-10 sm:top-8">
            <span className="text-sm font-semibold tracking-[0.3em] text-white/90">BULLZEYE</span>
          </div>

          {/* scroll hint (motion only) */}
          {!reducedMotion && (
            <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-center">
              <span className="text-[0.65rem] uppercase tracking-[0.3em] text-white/50">Scroll</span>
              <div className="mx-auto mt-2 h-8 w-px animate-pulse bg-gradient-to-b from-white/60 to-transparent" />
            </div>
          )}

          {/* tuning toggle */}
          <button
            type="button"
            onClick={() => setShowPanel((s) => !s)}
            className="absolute right-4 top-4 z-20 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[0.65rem] uppercase tracking-widest text-white/60 backdrop-blur transition hover:bg-white/10 hover:text-white/90"
          >
            {showPanel ? "Hide" : "Tune"}
          </button>
        </div>
      </section>
    </>
  );
}
