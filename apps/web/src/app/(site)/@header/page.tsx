import { SiteHeader } from "@/app/(site)/site-header";
import type { RawSearchParams } from "@/lib/search/parse-query";

type HeaderSlotProps = { searchParams: Promise<RawSearchParams> };

/**
 * The masthead over the listing, which is the one route whose URL has state the
 * wordmark has to carry home.
 *
 * A slot is a page: it matches the same segment `(site)/page.tsx` does -- the
 * route group adds no URL -- and is handed the same searchParams. That is the
 * whole reason it exists. The layout above it cannot be handed them, and asking
 * the request for them there would cost every posting its prerender; see the
 * note in layout.tsx.
 *
 * The promise is passed down rather than awaited here, exactly as the listing
 * page passes its own: awaiting it in this component would make the masthead
 * dynamic in one piece, when the only part that varies is one href.
 */
export default function HeaderSlot({ searchParams }: HeaderSlotProps) {
  return <SiteHeader searchParams={searchParams} />;
}
