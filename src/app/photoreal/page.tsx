import type { Metadata } from "next";
import { PhotorealHero } from "@/components/photoreal/PhotorealHero";

export const metadata: Metadata = {
  title: "BullzEye — Photoreal (plate) hero prototype",
  description:
    "A scroll-scrubbed photoreal hero built from pre-rendered Blender plates — cross-dissolve, Ken-Burns, and scan/trajectory overlays. A comparison prototype to the real-time WebGL hero.",
};

export default function PhotorealPage() {
  return (
    <main className="w-full bg-[#05070a]">
      <PhotorealHero />
    </main>
  );
}
