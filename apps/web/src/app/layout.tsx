import type { Metadata, Viewport } from "next";
import { Suspense } from "react";

import { siteUrl } from "@/lib/seo/site";

import "@/app/globals.css";

// THE SHARE PREVIEW, WRITTEN ONCE FOR EVERY URL THIS SITE SERVES.
//
// One object, spent on both openGraph.images and twitter.images, because Next
// resolves the two from separate fields and there is no field that feeds both.
// It sits in the ROOT layout so every route inherits it: metadata from the
// segments of a route is merged SHALLOWLY and duplicate keys are REPLACED
// (03-api-reference/04-functions/generate-metadata.md, "Merging": metadata with
// nested fields such as `openGraph` defined in an earlier segment are
// "overwritten by the last segment to define them"). Neither the board page nor
// a posting defines `openGraph` or `twitter` -- they set only `title`,
// `description` and `alternates` -- so nothing below overwrites this, and the
// image must NOT be repeated per page. Anything that later wants its own
// openGraph title has to spread this back in; that is the docs' own advice.
//
// Absolute, from NEXT_PUBLIC_SITE_URL via the existing siteOrigin helper, rather
// than a relative path resting on `metadataBase`. A crawler fetching the card has
// no document origin to resolve against, so "/share-preview.jpg" is not a
// smaller version of the right answer -- it is no answer.
//
// 1200x675 are the file's real pixels, read out of its SOF0 marker rather than
// assumed; both vocabularies use them to reserve the card's space before the
// bytes land. Next emits width, height and alt for BOTH (twitter:image:width and
// friends), so nothing in this object is wasted on the twitter half.
const SHARE_PREVIEW = {
  url: siteUrl("/share-preview.jpg"),
  width: 1200,
  height: 675,
  alt: "The Netflix wordmark in red above the word JOBS in white, on a black-to-red gradient",
};

export const metadata: Metadata = {
  title: "Careers at Netflix",
  description: "Careers at Netflix",
  openGraph: {
    title: "Careers at Netflix",
    description: "Careers at Netflix",
    siteName: "Careers at Netflix",
    url: "http://explore.jobs.netflix.net/careers",
    images: [SHARE_PREVIEW],
  },
  // summary_large_image, so the 16:9 file is drawn as the wide card it was cut to
  // be. The default `summary` would crop it into a small square thumbnail beside
  // the text, which is the one shape this image is wrong for.
  twitter: {
    card: "summary_large_image",
    title: "Careers at Netflix",
    description: "Careers at Netflix",
    images: [SHARE_PREVIEW],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

/**
 * THE ONE LINE THAT MAKES THE DOCUMENTS WHOLE.
 *
 * `<Suspense fallback={null}>` above `<body>` is the documented way to opt out of
 * the static shell (01-getting-started/08-caching.md, "Opting out of the static
 * shell"): "Because the fallback is empty, there is no static shell to send
 * immediately, so every request blocks until the page is fully rendered."
 *
 * That sentence reads like a cost and here it is the product. Both routes under
 * it hold their render in a `use cache` entry keyed on the whole of their input
 * -- the listing on the parsed query, a posting on its job code -- so "fully
 * rendered" is a cache read, not a Supabase round trip. What the shell was buying
 * was the right to send a ghost list early and stream the real one in behind it,
 * and a streamed-in boundary is delivered out-of-order: the rows landed in a
 * <div hidden> at the foot of the document and an inline script moved them.
 * Filtered results that need JavaScript to become visible are not server-rendered
 * results.
 *
 * With no shell to protect, the pages have no <Suspense> left inside them either,
 * so nothing suspends below this line and React emits one complete document per
 * request.
 *
 * It is in the ROOT layout rather than per route because that is the only place
 * it can be: the escape is a property of the document, and `<body>` is declared
 * here. The alternative the docs offer -- multiple root layouts -- would buy
 * nothing, since every route this app serves wants the same answer.
 */
export default function Base({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="h-full bg-black" lang="en">
      <Suspense fallback={null}>
        <body className="min-h-full bg-black">{children}</body>
      </Suspense>
    </html>
  );
}
