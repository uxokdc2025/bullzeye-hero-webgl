"use client";
import { createContext, useContext } from "react";
import type { AnimState } from "@/lib/animState";

/** Shares the single mutable anim-state proxy with every scene component. */
export const AnimContext = createContext<AnimState | null>(null);

export function useAnim(): AnimState {
  const a = useContext(AnimContext);
  if (!a) throw new Error("useAnim must be used inside <AnimContext.Provider>");
  return a;
}
