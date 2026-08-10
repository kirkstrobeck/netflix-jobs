import type { Metadata, Viewport } from "next";

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

export default function Base({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="h-full bg-black" lang="en">
      <body className="min-h-full bg-black">{children}</body>
    </html>
  );
}
