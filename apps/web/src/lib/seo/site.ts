// The origin this site is served from, for the handful of JSON-LD values that
// have to be absolute: the breadcrumb items and the hiring organization's logo.
//
// Everything else in the graph is already absolute because it belongs to Netflix
// -- a posting's `url` is jobs.canonical_url, the organization's `@id` is
// netflix.com -- so this is the only place the mirror's own address is needed.
//
// It is an environment variable rather than a constant because the mirror has no
// fixed home: the Lighthouse gate serves it on 127.0.0.1:3210, the dev server on
// :3000. Set NEXT_PUBLIC_SITE_URL wherever it is deployed.
const DEFAULT_ORIGIN = "http://localhost:3000";

export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_ORIGIN).replace(/\/+$/, "");
}

export function siteUrl(path: string): string {
  return `${siteOrigin()}${path}`;
}
