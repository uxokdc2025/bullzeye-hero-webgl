"use client";
import { useEffect } from "react";
import { useControls, folder } from "leva";
import { beats, scan, trajectory, timing } from "@/lib/config";
import { EASE_OPTIONS, type TunedConfig, type TunedBeat } from "@/lib/tuning";
import type { Vec3 } from "@/lib/config";

/**
 * Seeds a Leva panel from config.ts defaults and streams the merged, live
 * TunedConfig up to the Hero via onChange. Remounted (keyed) when the viewport
 * composition flips, so the panel always reflects the active beat set.
 */
export function TuningProvider({
  isMobile,
  onChange,
}: {
  isMobile: boolean;
  onChange: (cfg: TunedConfig) => void;
}) {
  const kf = (i: number) => (isMobile ? beats[i].mobile : beats[i].desktop);

  type LevaSchema = Parameters<typeof folder>[0];
  const beatSchema = beats.reduce<Record<string, ReturnType<typeof folder>>>((acc, b, i) => {
    const k = kf(i);
    acc[`${b.id} · ${b.name}`] = folder(
      {
        [`b${b.id}_pos`]: { value: k.pos as Vec3, label: "position" },
        [`b${b.id}_target`]: { value: k.target as Vec3, label: "target" },
        [`b${b.id}_len`]: { value: b.length, min: 0.2, max: 3, step: 0.05, label: "length" },
        [`b${b.id}_ease`]: { value: b.ease, options: EASE_OPTIONS, label: "ease" },
      },
      { collapsed: true }
    );
    return acc;
  }, {});

  const v = useControls({
    View: folder({
      fov: { value: isMobile ? 52 : 38, min: 20, max: 80, step: 1 },
    }),
    Timeline: folder({
      scrollVH: { value: timing.scrollVH, min: 300, max: 1200, step: 20 },
      scrub: { value: timing.scrub, min: 0, max: 2, step: 0.05 },
      gridDraw: { value: timing.gridDraw, min: 0.3, max: 3, step: 0.05 },
      facetFill: { value: timing.facetFill, min: 0.3, max: 3, step: 0.05 },
      trajectoryDraw: { value: timing.trajectoryDraw, min: 0.3, max: 3, step: 0.05 },
      ballRoll: { value: timing.ballRoll, min: 0.3, max: 3, step: 0.05 },
      scanRecede: { value: timing.scanRecede, min: 0, max: 1, step: 0.02 },
    }),
    Scan: folder({
      gridColor: { value: scan.gridColor },
      facetColor: { value: scan.facetColor },
      edgeColor: { value: scan.edgeColor },
      gridOpacity: { value: scan.gridOpacity, min: 0, max: 1, step: 0.02 },
      facetOpacity: { value: scan.facetOpacity, min: 0, max: 1, step: 0.02 },
      facetLightStrength: { value: scan.facetLightStrength, min: 0, max: 2, step: 0.05 },
      sweepSoftness: { value: scan.sweepSoftness, min: 0.02, max: 0.4, step: 0.01 },
    }),
    Trajectory: folder({
      trajColor: { value: trajectory.color, label: "color" },
      trajTipColor: { value: trajectory.tipColor, label: "tip" },
      breakAmount: { value: trajectory.breakAmount, min: 0, max: 4, step: 0.05 },
      trajRadius: { value: trajectory.radius, min: 0.01, max: 0.15, step: 0.005, label: "radius" },
      trajOpacity: { value: trajectory.opacity, min: 0.1, max: 1, step: 0.02, label: "opacity" },
    }),
    Beats: folder(beatSchema as LevaSchema, { collapsed: true }),
  });

  useEffect(() => {
    const vv = v as unknown as Record<string, unknown>;
    const tunedBeats: TunedBeat[] = beats.map((b) => ({
      name: b.name,
      pos: vv[`b${b.id}_pos`] as Vec3,
      target: vv[`b${b.id}_target`] as Vec3,
      length: vv[`b${b.id}_len`] as number,
      ease: vv[`b${b.id}_ease`] as string,
    }));
    onChange({
      fov: vv.fov as number,
      beats: tunedBeats,
      scan: {
        gridColor: vv.gridColor as string,
        facetColor: vv.facetColor as string,
        edgeColor: vv.edgeColor as string,
        gridOpacity: vv.gridOpacity as number,
        facetOpacity: vv.facetOpacity as number,
        facetLightStrength: vv.facetLightStrength as number,
        sweepSoftness: vv.sweepSoftness as number,
      },
      trajectory: {
        color: vv.trajColor as string,
        tipColor: vv.trajTipColor as string,
        opacity: vv.trajOpacity as number,
        radius: vv.trajRadius as number,
        breakAmount: vv.breakAmount as number,
      },
      timing: {
        scrollVH: vv.scrollVH as number,
        scrub: vv.scrub as number,
        gridDraw: vv.gridDraw as number,
        facetFill: vv.facetFill as number,
        trajectoryDraw: vv.trajectoryDraw as number,
        ballRoll: vv.ballRoll as number,
        scanRecede: vv.scanRecede as number,
      },
    });
  }, [v, onChange]);

  return null;
}
