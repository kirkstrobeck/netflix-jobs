import { SiteFooter } from "@/app/(site)/site-footer";

/**
 * The footer band on every route under (site) that is not the listing.
 *
 * The same <SiteFooter /> with nothing to carry -- and the file an unmatched
 * slot needs in order not to 404. The glow, the notice and the four links are
 * untouched by any of this; only the wordmark's href was ever in question.
 */
export default function FooterDefault() {
  return <SiteFooter />;
}
