import { asList, isAbsoluteUrl, isNode, isText, must, typeOf } from "@/lib/seo/rules/checks";

// Google's Organization requirements, from
// developers.google.com/search/docs/appearance/structured-data/organization
// (fetched 2026-08-09): "There are no required properties; instead, add the
// properties that apply to your organization."
//
// So every rule below is conditional, with one exception. A node with no name is
// not a smaller description of an organization, it is a description of nothing --
// name is what every other property is about, and Google's own guidance is to
// "use the same name as your site name". That one is enforced.
export function checkOrganization(value: unknown): string[] {
  const out: string[] = [];

  if (!isNode(value)) {
    return ["Organization must be a JSON object"];
  }

  const context = value["@context"];

  must(
    out,
    context === "https://schema.org" || context === "https://schema.org/",
    `@context must be https://schema.org, got ${JSON.stringify(context)}`,
  );
  must(out, typeOf(value) === "Organization", "@type must be Organization");
  must(out, isText(value.name), "name is required for the node to mean anything");

  must(
    out,
    value.url === undefined || isAbsoluteUrl(value.url),
    "url must be an absolute URL",
  );
  // "logo: URL or ImageObject... minimum 112x112px". The pixels are checked
  // against the file in tools/structured-data/logo.mjs; only the URL shape is
  // checkable here.
  must(
    out,
    value.logo === undefined || isAbsoluteUrl(value.logo),
    "logo must be an absolute URL",
  );
  must(
    out,
    asList(value.sameAs).every(isAbsoluteUrl),
    "sameAs must be absolute URLs",
  );
  // A node identified by @id has to be identified by something resolvable, or the
  // JobPosting that reuses the IRI is pointing at nothing.
  must(
    out,
    value["@id"] === undefined || isAbsoluteUrl(value["@id"]),
    "@id must be an absolute IRI",
  );

  return out;
}
