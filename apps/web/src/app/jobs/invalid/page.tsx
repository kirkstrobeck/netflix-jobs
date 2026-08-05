import { notFound } from "next/navigation";

// A not-found boundary is per route segment, so two different 404 messages need
// two segments -- there is no way to hand a reason to a single not-found.tsx.
// This segment exists purely to own the "never was a posting" boundary.
//
// proxy.ts rewrites malformed /jobs/<anything> here, which keeps the address the
// visitor typed in the URL bar while rendering this route. Calling notFound() is
// what produces the real 404 status; returning markup directly would ship a 200.
//
// No `metadata` export: notFound() discards it, which is exactly the dead-code
// trap this page used to contain. The tab title is rendered by not-found.tsx.
export default function InvalidJobIdPage() {
  notFound();
}
