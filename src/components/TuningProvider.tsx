"use client";
import { useEffect } from "react";
import { useControls, folder } from "leva";
import {
  beats, scan, trajectory, timing, grass, grassBlades, env, lighting, contactShadow, post, ao,
} from "@/lib/config";
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
    Grass: folder({
      grassTone: { value: grass.tone, label: "tint" },
      grassTiling: { value: grass.tiling, min: 2, max: 14, step: 0.5, label: "tiling" },
      grassSheen: { value: grass.sheen, min: 0, max: 1, step: 0.02, label: "sheen" },
      grassNormal: { value: grass.normalStrength, min: 0, max: 2, step: 0.05, label: "normal" },
      grassEnv: { value: env.grassIntensity, min: 0, max: 1.5, step: 0.05, label: "env" },
    }),
    "Grass blades": folder({
      bladeDensity: { value: 1.0, min: 0, max: 1, step: 0.05, label: "density" },
      bladeHeight: { value: grassBlades.height, min: 0.08, max: 0.6, step: 0.01, label: "height" },
      bladeHeightVar: { value: grassBlades.heightVar, min: 0, max: 1, step: 0.05, label: "height var" },
      bladeSway: { value: grassBlades.sway, min: 0, max: 2, step: 0.05, label: "sway" },
      bladeTint: { value: grassBlades.tint, label: "tint" },
    }),
    Light: folder({
      exposure: { value: lighting.exposure, min: 0.4, max: 1.4, step: 0.02 },
      keyIntensity: { value: lighting.keyIntensity, min: 0.5, max: 5, step: 0.05, label: "key" },
      shadowSoftness: { value: lighting.shadowRadius, min: 0, max: 20, step: 0.5, label: "shadow soft" },
    }),
    Ball: folder({
      ballEnv: { value: env.ballIntensity, min: 0, max: 2, step: 0.05, label: "env" },
    }),
    Shadow: folder({
      shadowOpacity: { value: contactShadow.opacity, min: 0, max: 1, step: 0.02, label: "opacity" },
      shadowBallScale: { value: contactShadow.ballScale, min: 1, max: 6, step: 0.1, label: "ball size" },
      shadowFlagScale: { value: contactShadow.flagScale, min: 0.3, max: 2.5, step: 0.05, label: "flag size" },
    }),
    AO: folder({
      aoIntensity: { value: ao.intensity, min: 0, max: 4, step: 0.05, label: "intensity" },
      aoRadius: { value: ao.radius, min: 0.1, max: 4, step: 0.05, label: "radius" },
      aoFalloff: { value: ao.distanceFalloff, min: 0.1, max: 3, step: 0.05, label: "falloff" },
    }),
    Post: folder({
      bokehScale: { value: post.bokehScale, min: 0, max: 8, step: 0.1 },
      focusRange: { value: post.focusRange, min: 0.002, max: 0.08, step: 0.002 },
      bloomIntensity: { value: post.bloomIntensity, min: 0, max: 2, step: 0.05 },
      bloomThreshold: { value: post.bloomThreshold, min: 0, max: 1, step: 0.02 },
      vignetteDarkness: { value: post.vignetteDarkness, min: 0, max: 1.5, step: 0.05 },
      grain: { value: post.grain, min: 0, max: 0.12, step: 0.005 },
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
      grass: {
        tone: vv.grassTone as string,
        tiling: vv.grassTiling as number,
        sheen: vv.grassSheen as number,
        normalStrength: vv.grassNormal as number,
        envIntensity: vv.grassEnv as number,
      },
      grassBlades: {
        density: vv.bladeDensity as number,
        height: vv.bladeHeight as number,
        heightVar: vv.bladeHeightVar as number,
        sway: vv.bladeSway as number,
        tint: vv.bladeTint as string,
      },
      lighting: {
        exposure: vv.exposure as number,
        keyIntensity: vv.keyIntensity as number,
        shadowRadius: vv.shadowSoftness as number,
      },
      ballEnvIntensity: vv.ballEnv as number,
      contactShadow: {
        opacity: vv.shadowOpacity as number,
        ballScale: vv.shadowBallScale as number,
        flagScale: vv.shadowFlagScale as number,
      },
      post: {
        bokehScale: vv.bokehScale as number,
        focusRange: vv.focusRange as number,
        bloomIntensity: vv.bloomIntensity as number,
        bloomThreshold: vv.bloomThreshold as number,
        vignetteDarkness: vv.vignetteDarkness as number,
        grain: vv.grain as number,
        aoIntensity: vv.aoIntensity as number,
        aoRadius: vv.aoRadius as number,
        aoFalloff: vv.aoFalloff as number,
      },
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
