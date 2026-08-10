import type { Metadata } from "next";

import { CLOSING, HEADLINES, SECTIONS } from "@/app/(site)/about/about-copy";
import { BarsStage } from "@/app/_bars/bars-stage";
import { UltraText } from "@/app/_ultra/ultra-text";

import "@/app/_ultra/ultra.css";
import "@/app/(site)/about/about.css";

export const metadata: Metadata = {
  title: "About this board",
  description:
    "A server-rendered mirror of the Netflix careers board: 100% test coverage, 100 Lighthouse on mobile and desktop, and no migration.",
};

// No route segment config. Under cacheComponents a page with no dynamic input
// prerenders on its own -- this one reads no database, no cookie and no header,
// so it is one static document and `dynamic` would be rejected as redundant.

/**
 * The one page that describes the board rather than searching it.
 *
 * Its markup is the site's own: the same <BarsStage> masthead the listing and
 * the role pages carry, the same <UltraText> headline, the same .shell column,
 * the same type scale and tokens. about.css adds a stat grid and a prose measure
 * and nothing else -- no framework, no new dependency.
 *
 * The five claims come first, as a list, because a reader who stops after the
 * top of the page should still have the whole argument.
 */
export default function AboutPage() {
  return (
    <>
      <BarsStage as="header" className="masthead" contentClassName="shell">
        <UltraText as="h1" className="masthead__title">
          Built to be read, indexed and applied to
        </UltraText>
      </BarsStage>

      <div className="shell about">
        <p className="about__lede">
          Every open role at Netflix, server-rendered, on Netflix&rsquo;s own data
          and platform. Here is what that is worth.
        </p>

        <ul className="about__stats">
          {HEADLINES.map((item) => (
            <li className="stat" key={item.claim}>
              <p className="stat__figure">
                <strong className="stat__number">{item.stat}</strong>{" "}
                <span className="stat__claim">{item.claim}</span>
              </p>
              <p className="stat__detail">{item.detail}</p>
            </li>
          ))}
        </ul>

        {SECTIONS.map((section) => (
          <section aria-labelledby={section.id} className="about__section" key={section.id}>
            <h2 className="about__heading" id={section.id}>
              {section.heading}
            </h2>
            {section.body.map((paragraph) => (
              <p className="about__body" key={paragraph.slice(0, 24)}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        <section aria-labelledby="next" className="about__section">
          <h2 className="about__heading" id="next">
            Where this goes next
          </h2>
          <p className="about__body">{CLOSING}</p>
        </section>
      </div>
    </>
  );
}
