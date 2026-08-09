import { isAbsoluteUrl, isNode, isText, must, typeOf } from "@/lib/seo/rules/checks";

// Google's BreadcrumbList requirements, from
// developers.google.com/search/docs/appearance/structured-data/breadcrumb
// (fetched 2026-08-09).
//
//   itemListElement  Required. "An array of breadcrumbs listed in a specific
//                    order... Specify each breadcrumb with a ListItem."
//   item             Required per ListItem, except: "If the breadcrumb is the
//                    last item in the breadcrumb trail, item is not required. If
//                    item isn't included for the last item, Google uses the URL
//                    of the containing page."
//   name             "The title of the breadcrumb displayed for the user."
//   position         Required. "Position 1 signifies the beginning of the trail."
export function checkBreadcrumbList(value: unknown): string[] {
  const out: string[] = [];

  if (!isNode(value)) {
    return ["BreadcrumbList must be a JSON object"];
  }

  const context = value["@context"];

  must(
    out,
    context === "https://schema.org" || context === "https://schema.org/",
    `@context must be https://schema.org, got ${JSON.stringify(context)}`,
  );
  must(out, typeOf(value) === "BreadcrumbList", "@type must be BreadcrumbList");

  const items = value.itemListElement;

  must(
    out,
    Array.isArray(items) && items.length > 0,
    "itemListElement must be a non-empty array of ListItem",
  );

  if (!Array.isArray(items)) {
    return out;
  }

  items.forEach((item, index) => {
    const at = `itemListElement[${index}]`;
    const last = index === items.length - 1;

    must(out, typeOf(item) === "ListItem", `${at} must be a ListItem`);
    must(
      out,
      isNode(item) && item.position === index + 1,
      `${at}.position must be ${index + 1}`,
    );
    must(out, isNode(item) && isText(item.name), `${at}.name is required`);
    must(
      out,
      last || (isNode(item) && isAbsoluteUrl(item.item)),
      `${at}.item is required for every breadcrumb but the last`,
    );
  });

  return out;
}
