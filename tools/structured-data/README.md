# The structured-data gate

`pnpm test:structured-data`, and part of `pnpm test:all`.

It builds the JSON-LD for **every active posting in the database** with the same
functions the pages import, then checks the result against the published specs.
Today that is 481 postings, one Organization node, 481 breadcrumb trails and one
llms.txt, in about a second — so there is no sampling, deterministic or
otherwise. If it ever needs one, take a slice ordered by `position_id` and print
what was skipped; a gate that quietly stops covering things is worse than no
gate.

## What it checks against

Not a fixture. A snapshot of our own output passes just as happily when both
sides are wrong together, which is the failure mode this exists to prevent. The
rules are transcribed from the specs, with the sentence each one comes from
quoted beside it in the source:

| Rules | Source |
| --- | --- |
| `apps/web/src/lib/seo/rules/job-posting-rules.ts` | [Google JobPosting](https://developers.google.com/search/docs/appearance/structured-data/job-posting) |
| `apps/web/src/lib/seo/rules/organization-rules.ts` | [Google Organization](https://developers.google.com/search/docs/appearance/structured-data/organization) |
| `apps/web/src/lib/seo/rules/breadcrumb-rules.ts` | [Google Breadcrumb](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) |
| `apps/web/src/lib/llms/validate-llms-txt.ts` | [llmstxt.org](https://llmstxt.org/) |

Google's list is stricter than schema.org's and is the one that decides whether
a rich result appears, so it is the one enforced. schema.org's own vocabulary is
enforced separately and earlier, by `schema-dts` — the builders return
`WithContext<JobPostingLeaf>` and friends, so a misspelled property or a value of
the wrong type is a `tsc` error, not a runtime surprise. `pnpm test:types` is in
`test:all` for exactly that reason.

There is no maintained runtime schema.org validator on npm worth depending on:
`schemarama` last published in 2022, `structured-data-testing-tool` the same.
`schema-dts` (Google, published 2026) is the maintained one, and it works at
compile time.

## What it cannot check

- **Pixels.** `logo.mjs` reads the PNG header instead, because "minimum 112x112"
  and "ratio between 0.75 and 2.5" are facts about the file, not the markup.
- **Whether the script tag ships.** That is
  `apps/web/src/app/(site)/jobs/[jobid]/page.test.tsx`, which renders the page,
  parses the JSON back out of the HTML and runs these same rules over it.
- **Whether Google agrees.** Paste a page into the
  [Rich Results Test](https://search.google.com/test/rich-results) for that.

## The Lighthouse cost, measured

Google requires `description` to be "the full description of the job in HTML
format", so a job page now carries its description twice: once for the reader,
once for the crawler. That is not free, and on `/jobs/JR41938` it is the
difference between the Lighthouse gate passing and failing:

| | document (raw) | transferred (gzip) | LCP | performance |
| --- | --- | --- | --- | --- |
| before | 60,741 B | 13,058 B | 790 ms (0.98) | 100 |
| after | 79,182 B | 14,081 B | 829 ms (0.97) | **99** |

Two things are worth knowing before anyone tries to shave it:

- **Roughly half the growth is React's copy, not ours.** The two `<script>`
  blocks are 7.9 KB; the document grew 18.4 KB, because the RSC flight payload
  Next inlines carries the element tree — and a `dangerouslySetInnerHTML`
  string is a text child of it. The visible description already pays this same
  toll. There is no App Router escape hatch for it.
- **Position and escaping are not the lever.** Moving the blocks below the
  article left LCP at 0.97; minimal `<` escaping bought 448 gzipped bytes.
  Neither recovers the point.

The real headroom is elsewhere: this page loads a **129 KB render-blocking
stylesheet of which Lighthouse calls 123 KB unused, costing 284 ms**. The 100 it
scored before was 99.5 rounded up — LCP was already at 0.98. Reclaiming that CSS
would restore a real margin instead of a rounding one.

## Failure output

Every failure names the job code, the property and the rule. `SD_SAMPLE_JOB=JR41912`
pins which posting gets printed on success.
