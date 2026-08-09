import type { OrganizationLeaf, WithContext } from "schema-dts";

import { siteUrl } from "@/lib/seo/site";

// Netflix, described once.
//
// Google's Organization guidance is "place this information on your home page,
// or a single page that describes your organization"
// (developers.google.com/search/docs/appearance/structured-data/organization),
// so the full node is emitted by the listing page and nowhere else -- not the
// root layout, which would repeat it on every 404 and on the bare /foo route.
//
// Job pages do NOT reference it with a bare {"@id"}. hiringOrganization is a
// REQUIRED property of JobPosting and Google evaluates each page on its own; a
// pointer to a node defined on a different URL would leave the posting without
// one. So the posting carries the organization inline, under the same @id. Same
// IRI means one entity, not two: this is JSON-LD node identity, which is exactly
// the mechanism for saying "this is that Netflix" without a second definition.
export const NETFLIX_ID = "https://www.netflix.com/#organization";

const NETFLIX_URL = "https://www.netflix.com";

// 192x192, square. Google wants an Organization logo of at least 112x112 and,
// for JobPosting, "the image width and height ratio must be between 0.75 and
// 2.5". The wordmark in public/logo is 1427x383 -- ratio 3.7 -- so it fails that
// rule; src/app/icon1.png is the square mark and is served at this route by
// Next's icon file convention. tools/structured-data/logo.mjs reads the PNG
// header and pins both numbers, so swapping in wide artwork fails the gate.
const LOGO_PATH = "/icon1.png";

export function netflixLogo(): string {
  return siteUrl(LOGO_PATH);
}

// The properties Google names for hiringOrganization, and only those we can
// state as fact: the company name, the company's own site as sameAs (Google's
// example uses exactly that), and a logo we serve ourselves.
export function hiringOrganization(): OrganizationLeaf {
  return {
    "@type": "Organization",
    "@id": NETFLIX_ID,
    name: "Netflix",
    sameAs: NETFLIX_URL,
    logo: netflixLogo(),
  };
}

// The standalone node for the listing page. url and sameAs point at Netflix's
// own properties -- the same ones this site's footer already links to -- so
// nothing here is a guess about an entity we do not control.
export function netflixOrganization(): WithContext<OrganizationLeaf> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": NETFLIX_ID,
    name: "Netflix",
    url: NETFLIX_URL,
    logo: netflixLogo(),
    sameAs: [NETFLIX_URL, "https://about.netflix.com/en", "https://jobs.netflix.com"],
  };
}
