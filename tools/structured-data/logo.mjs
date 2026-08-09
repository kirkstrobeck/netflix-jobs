import { readFileSync } from "node:fs";

// Google states two things about the logo the markup points at:
//
//   Organization: "Minimum 112x112px"
//   JobPosting:   "the image width and height ratio must be between 0.75 and 2.5"
//
// Both are facts about the FILE, so neither can be checked by looking at the
// JSON-LD. This reads the PNG header and checks them, which is what stops the
// square mark being swapped for the 1427x383 wordmark -- ratio 3.7, and markup
// that still validates everywhere else.
const MIN_EDGE = 112;
const MIN_RATIO = 0.75;
const MAX_RATIO = 2.5;

// IHDR is the first chunk of every PNG: width and height are big-endian uint32
// at bytes 16 and 20.
export function pngSize(path) {
  const bytes = readFileSync(path);

  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export function checkLogo(path) {
  const { width, height } = pngSize(path);
  const ratio = width / height;
  const out = [];

  if (width < MIN_EDGE || height < MIN_EDGE) {
    out.push(`logo is ${width}x${height}; Google wants at least ${MIN_EDGE}x${MIN_EDGE}`);
  }

  if (ratio < MIN_RATIO || ratio > MAX_RATIO) {
    out.push(
      `logo ratio is ${ratio.toFixed(2)}; JobPosting requires ${MIN_RATIO}-${MAX_RATIO}`,
    );
  }

  return { violations: out, width, height, ratio };
}
