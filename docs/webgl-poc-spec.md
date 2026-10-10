# BullzEye Hero — WebGL scrollytelling POC

Standalone proof of concept. A premium, cinematic, full-screen 3D scrollytelling hero for BullzEye (golf green-reading tech). ONE continuous 3D environment (not separate scenes/videos), real-time rendered, the scroll position scrubs a single deterministic timeline (reverse scroll works). This is a VISUAL POC, not a validated putting simulation — use a believable curved trajectory, and keep illustrative geometry clearly separate from "real BullzEye scan data".

## Stack (installed)
Next.js (App Router, TS, Tailwind) + `three` + `@react-three/fiber` + `@react-three/drei` + `gsap` (ScrollTrigger) + `leva` (tuning panel) + `maath`. Dev on port 3030.

## References (public/references/, use as VISUAL guidance only — don't ship the PNGs as scene content)
- 04_scan_overlay_actual_app.png — the faceted translucent scan look to emulate on the terrain.
- 03_trajectory_visual_reference.png — the curved putt trajectory style.
- 05/06 green_flag_wide/mid, 07_green_hole_close, 08_ball_at_hole — green/flag/cup/ball realism + framing.
- 09–13 ball_roll_0x — the ball-roll money shot reference.
- 02_website_current.png, 01_story_onboarding.png — brand context.
Read docs/reference-readme.md for any notes.

## The 3D scene (one environment)
- **Golf ball**: realistic PBR sphere (dimples via normal map or subtle geometry), physically sane size relative to the green.
- **Putting green**: a contoured grass surface — a subdivided plane displaced by a smooth noise/heightfield so it has real slope/break; grass via a shader or tiled texture + micro-normal; dark, photographic.
- **Hole/cup** + **flagstick & flag** (cloth-ish or simple), positioned on the green.
- **Faceted terrain scan mesh**: a translucent, glass-like faceted overlay that conforms to the SAME heightfield as the green (so it hugs the real contours). It first DRAWS as a grid (lines animate on), then FILLS with translucent facets. Subtle blue/purple/jade tint. No neon/outer-glow — a refined glass/scan material.
- **Trajectory**: a curved line (CatmullRom/quadratic) from ball to hole that DRAWS on; clearly "illustrative".
- The ball later rolls along that trajectory into the cup.

## Narrative / camera sequence (6 beats, scrubbed by scroll)
1. **Macro** — extreme close-up of the ball on grass, flag soft in the distance.
2. **Aerial reveal** — camera smoothly pulls back + rises to reveal green, ball, hole. Text enters LEFT.
3. **Terrain scan** — grid draws across the surface, then fills with the translucent faceted glass mesh following the contours. Text enters RIGHT.
4. **Trajectory** — mesh settles/partially recedes; the curved putt trajectory draws from ball to hole. Text enters LEFT.
5. **Camera dive** — camera descends to a low tracking position behind the ball.
6. **Money shot** — ball rolls along the trajectory; camera follows it into the hole. Final text enters RIGHT.

## Implementation
- **Full-viewport pinned WebGL canvas** (fixed/pinned via ScrollTrigger pin); a tall scroll container drives the timeline. The R3F `<Canvas>` stays mounted; GSAP timeline `progress` is driven by `ScrollTrigger` scrub.
- **Single GSAP timeline**: camera position/target, mesh reveal, trajectory draw, ball roll, and text all as tweens on ONE timeline so forward/reverse scrub is coherent and deterministic. Drive three objects from the timeline (use a proxy object or refs updated in useFrame from timeline-updated values).
- **Scroll-synced text**: left/right copy blocks per beat, fade/slide in on their segment (HTML overlay above the canvas). Placeholder but on-brand copy (e.g. "See the green differently", "A clearer read", "Trust your line") — no fabricated metrics.
- **Desktop + mobile camera compositions**: separate camera keyframe sets (or offsets) for narrow screens so framing holds; switch by viewport.
- **Reduced-motion**: `prefers-reduced-motion` → no scroll-jacking/scrub; show a tasteful static composed frame (or a few stepped states) that still tells the story; the canvas renders a still.
- **Performance**: cap DPR (e.g. min(devicePixelRatio,2)), reasonable geometry subdivisions, dispose properly, lazy/suspense the canvas, `frameloop` demand where possible. Keep it smooth on a laptop and a phone.
- **TUNING CONTROLS (required)**: a Leva panel exposing EVERY camera keyframe (position xyz + target xyz per beat), each beat's duration/scroll-length, easing, and the scan appearance (grid density, facet opacity, tint color, draw speed) and trajectory (curve height, draw speed, ball roll speed). Group logically. Also centralize all of this in a single `config.ts` (the Leva panel edits live; config.ts holds the defaults) so values are independently tunable without hunting through code. A `?tune=1` query param (or a Leva toggle) can show/hide the panel; hidden by default on a clean load.

## Visual direction
Premium cinematic golf realism; realistic grass/ball/cup/flag; dark, sophisticated photographic lighting (a key light + soft fill + subtle rim; HDRI environment via drei `Environment` for believable reflections on the ball); subtle blue/purple/jade tech accents ONLY on the scan/trajectory/UI; NO neon, outer glows, or exaggerated effects. Preserve BullzEye's faceted terrain + translucent scan treatment.

## Do NOT
Touch any other repo or the production site/app. This is self-contained in bullzeye-hero-webgl.

## Acceptance / deliverable
- `pnpm build` passes; `pnpm dev` runs on :3030; the experience works end-to-end on desktop width AND a mobile width (test 390), scrubbing forward and reverse through all 6 beats, with the scan + trajectory + ball-roll reading clearly.
- Reduced-motion path works. Leva tuning panel exposes camera/scan/timing as specified; config.ts holds defaults.
- No console errors; acceptable perf (smooth scrub). Commit + push to origin/main. (Coordinator deploys to Vercel.)
