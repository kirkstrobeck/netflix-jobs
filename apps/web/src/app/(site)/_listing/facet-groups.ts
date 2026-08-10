import type { FacetKey } from "@/lib/search/job-query";

/**
 * The checkbox groups the panel draws, as data.
 *
 * Split out of facets-panel.tsx, which was 244 lines and is the layout: what
 * each group is CALLED is a fixed property of the group, and the panel only has
 * to know the order to put them in. The rationale for each one stays with the
 * group it belongs to rather than sitting above a component that renders five.
 *
 * `plural` and `singular` are the group's name as a noun, and the only place it
 * is written: the option search's label and the disclosure that opens the rest
 * of the list are both built from them.
 */
export type FacetGroupSpec = {
  key: FacetKey;
  legend: string;
  plural: string;
  singular: string;
};

// FIRST, AND ABOVE KEYWORDS
//
// Work type is two values, so it is the one group that is complete on screen --
// no search box worth using, no disclosure -- and for the 102 roles that are
// remote it half-answers the location question below it.
export const WORK_TYPE: FacetGroupSpec = {
  key: "workType",
  legend: "Work type",
  plural: "work types",
  singular: "work type",
};

/**
 * AFTER LOCATION, BEFORE TEAM
 *
 * "Where" and "at what level" are the two questions someone reads a job board
 * with, and this is the second of them. It sits under Location because a
 * country can arrive already ticked and answered, and above Team because Team
 * is 32 values behind a disclosure -- the shorter, closed list goes first.
 *
 * Six options, so exactly one falls behind "Show 1 more seniority level". That
 * is the disclosure doing its job rather than a group that needs a bigger
 * budget: the six are ordered by count like every other group, so what gets
 * folded away is whichever rung the board currently has fewest of.
 *
 * The values are DERIVED, which no other group's are -- see seniority.ts. The
 * panel does not need to know that and deliberately does not say it: an option
 * here behaves like an option anywhere, and 30% of postings simply appear under
 * none of them.
 */
export const SENIORITY: FacetGroupSpec = {
  key: "seniority",
  legend: "Seniority",
  plural: "seniority levels",
  singular: "seniority level",
};

export const TEAM: FacetGroupSpec = {
  key: "team",
  legend: "Team",
  plural: "teams",
  singular: "team",
};

// LAST, AND IT IS HERE BECAUSE THE ROLE PAGES LINK TO IT
//
// Three values -- Streaming 428, Animation 43, Creations 10 -- so it is the
// coarsest question on the panel and the one fewest people arrive with: nobody
// opens a job board having already decided between Streaming and Animation.
// What they do is read a role, notice it is an Animation posting, and want the
// other forty-two. That link is the reason this group exists (see job-details),
// and a filter reachable by link has to be a box you can also see and untick --
// otherwise arriving on one is arriving on a filter with no control, which is
// the same invisible-filter bug the top-five disclosure is careful to avoid.
//
// Bottom of the panel, not beside Work type, even though the two are the same
// shape. Position here is how often a question is asked, and this one is asked
// least; the lists in between are the ones people came for.
export const BUSINESS_UNIT: FacetGroupSpec = {
  key: "businessUnit",
  legend: "Business unit",
  plural: "business units",
  singular: "business unit",
};
