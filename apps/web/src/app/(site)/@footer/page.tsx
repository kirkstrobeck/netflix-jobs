import { SiteFooter } from "@/app/(site)/site-footer";
import type { RawSearchParams } from "@/lib/search/parse-query";

type FooterSlotProps = { searchParams: Promise<RawSearchParams> };

/**
 * The footer band under the listing.
 *
 * A second slot rather than one that emits both bands, because the two sit on
 * either side of <main> and a slot cannot wrap the page between them. It carries
 * the same searchParams for the same reason: the footer's wordmark is the same
 * component as the masthead's, so it either carries the visitor's facets in both
 * places or in neither.
 */
export default function FooterSlot({ searchParams }: FooterSlotProps) {
  return <SiteFooter searchParams={searchParams} />;
}
