// Next bundles path-to-regexp without types, and cache-headers.test.ts needs it
// for the one thing only Next's own copy can answer: whether a `source` pattern
// in the headers config matches a given URL. Matching it with a hand-written
// regex would be testing our idea of the syntax rather than the router's.
declare module "next/dist/compiled/path-to-regexp" {
  export function pathToRegexp(path: string): RegExp;
}
