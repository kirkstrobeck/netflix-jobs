// What the render-blocking stylesheets on one page actually weigh.
//
// first-paint.mjs answers what they COST -- milliseconds of first contentful
// paint. This answers the smaller, flatter question /about makes a claim about:
// how many bytes the document blocks on, uncompressed and over the wire.
//
// Read off the served document rather than off the import graph, because the
// import graph is not the answer: Turbopack merges and splits sheets per route,
// and _glow/glow.generated.css is imported by a component that deliberately
// keeps it OFF the critical path. What blocks is what came back as a
// <link rel="stylesheet"> in <head>, and nothing else.
//
// Two byte counts, because they measure different things and the copy quotes
// both. Uncompressed is what the engine parses -- the number that does not move
// when the network does. gzip is what the wire carries.
//
// The gzip figure is computed here rather than read off the response, and that
// is forced: node's fetch decodes a compressed body transparently and strips
// content-length when it does, so the encoded length is not observable through
// it. The `encoding` column is still read off the server, so the table shows
// whether the server would in fact have compressed the sheet -- which is the
// part a local gzip cannot stand in for.
//
// Usage: node tools/probe/blocking-css.mjs [url]
import { gzipSync } from "node:zlib";

const URL_UNDER_TEST = process.argv[2] ?? "http://127.0.0.1:3103/about";
const origin = new URL(URL_UNDER_TEST).origin;

const document = await (await fetch(URL_UNDER_TEST)).text();
const head = document.slice(0, document.indexOf("</head>"));

// rel="stylesheet" in the head only. A sheet appended later by the runtime is
// not render-blocking and must not be counted as if it were.
const hrefs = [...head.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map(
  (match) => match[1],
);

console.log(`${URL_UNDER_TEST}`);
console.log(`${hrefs.length} render-blocking stylesheets\n`);
console.log(["sheet", "raw", "gzip", "encoding"].map((h, i) => h.padEnd([42, 10, 10, 10][i])).join(""));

let raw = 0;
let wire = 0;

for (const href of hrefs) {
  const plain = await fetch(origin + href, { headers: { "accept-encoding": "identity" } });
  const body = Buffer.from(await plain.arrayBuffer());
  const bytes = body.byteLength;

  // Node's fetch decodes transparently AND strips content-length when it does,
  // so the wire size cannot be read back off the response at all. gzipped here
  // instead, at the default level, which is what a server encodes at.
  const zipped = await fetch(origin + href, { headers: { "accept-encoding": "gzip" } });
  const encoding = zipped.headers.get("content-encoding") ?? "identity";
  const onWire = gzipSync(body).byteLength;

  raw += bytes;
  wire += onWire;

  console.log(
    [
      href.split("/").pop().padEnd(42),
      String(bytes).padStart(8).padEnd(10),
      String(onWire).padStart(8).padEnd(10),
      encoding,
    ].join(""),
  );
}

console.log(
  ["", "-".repeat(8), "-".repeat(8)].map((h, i) => h.padEnd([42, 10, 10][i])).join(""),
);
console.log(
  ["TOTAL".padEnd(42), String(raw).padStart(8).padEnd(10), String(wire).padStart(8)].join(""),
);
console.log(`\n${raw.toLocaleString("en-US")} bytes uncompressed, ${wire.toLocaleString("en-US")} on the wire`);
