import type { Metadata } from "next";

import {
  GIFT,
  GROUPS,
  HEADLINE,
  HEADLINES,
  LINKEDIN,
  SIGNATURE,
  TITLE,
} from "@/app/(site)/about/about-copy";
import { BarsStage } from "@/app/_bars/bars-stage";
import { UltraText } from "@/app/_ultra/ultra-text";

import "@/app/_ultra/ultra.css";
import "@/app/(site)/about/about.css";

export const metadata: Metadata = {
  title: TITLE,
  description:
    "What this project does: 100% test coverage, 100 Lighthouse on mobile for accessibility, best practices, SEO and agentic browsing across all three pages, and every page rendered on the server.",
};

// No route segment config. Under cacheComponents a page with no dynamic input
// prerenders on its own -- this one reads no database, no cookie and no header,
// so it is one static document and `dynamic` would be rejected as redundant.

/**
 * A catalogue of what this project does.
 *
 * The order is masthead, page title, five claims, then one h2 per group. There
 * is no narrative: a reader who stops after any group has read whole facts.
 *
 * THE TITLE IS IN THE BAND, AT DISPLAY SIZE.
 *
 * It was on .masthead__title, a class that lives in home-masthead.css and which
 * only the listing imports -- so on this page the h1 had no rules, inherited
 * body type, and rendered at 16px inside a 24px band. Measured in Chromium.
 *
 * The band and the title are this page's own now. .about-masthead gives the band
 * a height to sit in and .about__title the display scale, both in about.css, so
 * the h1 reads as a page title over the bars rather than as a line of chrome.
 */
export default function AboutPage() {
  return (
    <>
      <BarsStage as="header" className="about-masthead" contentClassName="shell">
        <UltraText as="h1" className="about__title">
          {HEADLINE}
        </UltraText>
      </BarsStage>

      <div className="shell about">
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

        {GROUPS.map((group) => (
          <section aria-labelledby={group.id} className="about__group" key={group.id}>
            <h2 className="about__heading" id={group.id}>
              {group.heading}
            </h2>
            <ul className="about__list">
              {group.points.map((point) => (
                <li className="about__point" key={point}>
                  {point}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* Last on the page, and the only place a name appears. */}
        <p className="about__gift">{GIFT}</p>
        <p className="about__signature">
          {SIGNATURE}
          <a
            className="about__link"
            href={LINKEDIN.href}
            rel="noopener noreferrer"
            target="_blank"
          >
            {LINKEDIN.label}
          </a>
        </p>
      </div>
    </>
  );
}
