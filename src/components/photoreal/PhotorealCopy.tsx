"use client";
import { copy } from "@/lib/config";

/**
 * Per-beat copy blocks for /photoreal. Type treatment is copied verbatim from
 * the real-time hero's TextOverlay so both heroes read as the same brand:
 * eyebrow (violet, wide-tracked caps) · title (balance, tight) · body (pretty).
 *
 * Motion path: blocks are absolutely anchored left/right per `copy[].side` and
 * carry `data-pr-copy` so the GSAP timeline can fade/slide them in lockstep
 * with the plate cross-dissolves, forward and reverse.
 *
 * Reduced-motion / static path: a stacked, already-visible variant.
 */
export function PhotorealCopy({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) {
    return (
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-center gap-8 px-6 sm:px-16">
        {copy.map((c) => (
          <div
            key={c.beat}
            className={`max-w-md ${c.side === "right" ? "self-end text-right" : "self-start text-left"}`}
          >
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-[#8a7df0]">
              {c.eyebrow}
            </p>
            <h2 className="mb-2 text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {c.title}
            </h2>
            <p className="text-sm leading-relaxed text-white/70 sm:text-base">{c.body}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      {copy.map((c) => (
        <div
          key={c.beat}
          data-pr-copy={c.beat}
          style={{ opacity: c.beat === 1 ? 1 : 0 }}
          className={[
            "absolute top-1/2 w-[min(86vw,30rem)] -translate-y-1/2 will-change-[transform,opacity]",
            c.side === "right" ? "right-6 text-right sm:right-16" : "left-6 text-left sm:left-16",
          ].join(" ")}
        >
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#9b8ff5] sm:text-xs">
            {c.eyebrow}
          </p>
          <h2 className="mb-3 text-balance text-3xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
            {c.title}
          </h2>
          <p className="text-pretty text-sm leading-relaxed text-white/75 sm:text-lg">{c.body}</p>
        </div>
      ))}
    </div>
  );
}
