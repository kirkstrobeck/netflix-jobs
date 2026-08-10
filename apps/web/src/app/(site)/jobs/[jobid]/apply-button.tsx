import { UltraSurface } from "@/app/_ultra/ultra-surface";
import { UltraText } from "@/app/_ultra/ultra-text";
import { CTA_RADIUS, ULTRA_ACCENT } from "@/app/(site)/jobs/[jobid]/cta-ultra";

// A plain anchor, not a button: it navigates. Netflix red is used as a
// background with white text, which clears WCAG AA at 4.79:1 — the same red as
// small text on #080202 would only reach 4.3:1 and fail.
//
// What the fill cannot do is hold the button's own EDGE against the hero's
// bars, which are the same red. That is job-cta.css's problem and the numbers
// are there.
//
// TWO ULTRA PASSES, NOT ONE.
//
// <UltraSurface> paints the plate past reference white, in the accent rather
// than in white, so the button is brighter red rather than a white slab.
// <UltraText> paints the label, masked to its glyphs. Masking one fill to the
// whole button instead would draw the label into the canvas -- and a canvas
// cannot be selected, copied, or read out, so the label would stop being text.
// Two passes keeps the plate a picture and the words a text node.
//
// The visually-hidden suffix stays OUTSIDE the Ultra label: it is there for a
// screen reader, it is never painted, and putting it under a mask would be a
// second run of text for the glyph measurement to chase.
export function ApplyButton({ href, title }: { href: string; title: string }) {
  return (
    <a
      className="apply-button ultra-plate"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <UltraSurface colour={ULTRA_ACCENT} radius={CTA_RADIUS} />
      <UltraText className="cta__label">Apply for this role</UltraText>
      <span className="visually-hidden">: {title}</span>
    </a>
  );
}
