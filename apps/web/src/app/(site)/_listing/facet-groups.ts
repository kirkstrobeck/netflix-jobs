import type { FacetKey } from "@/lib/search/job-query";

/**
 * The checkbox groups the panel draws, as data.
 *
 * Split out of facets-panel.tsx, which was 244 lines and is the layout: what
 * each group is CALLED is a fixed property of the group, and the panel only has
 * to know the order to put them in. The rationale for each one stays with the
 * group it belongs to rather than sitting above a component that renders five.
 *
 * `plural` is the group's name as a noun, and the only place it is written:
 * the option search's label and the disclosure that opens the rest of the list
 * are both built from it. The singular went with the "1 more team" wording --
 * see facet-disclosure.ts, where the three-row floor made that case unreachable.
 */
export type FacetGroupSpec = {
  key: FacetKey;
  legend: string;
  plural: string;
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
};

/**
 * LAST ON THE PANEL
 *
 * Asked for in those words, and it displaces Business unit from the bottom.
 *
 * It used to sit between Location and Team, on the reading that "where" and "at
 * what level" are the two questions someone opens a job board with. The second
 * half of that is the weaker claim: a level is how you narrow a shortlist you
 * already have, not how you start one, and this is the one group on the panel
 * that cannot answer honestly for every role -- 139 of the 481 titles state no
 * rung at all, so ticking anything here silently drops 29% of the board. A
 * filter with a blind spot that size is a poor thing to meet first and a fine
 * thing to reach for last.
 *
 * Six options, and past the fifth the tail is one rung -- so no disclosure at
 * all now, and the whole ladder stands open. See facet-disclosure.ts.
 *
 * The order of the options is the ladder rather than the counts, which is this
 * group alone: entry, mid, senior, staff, and the management track above them.
 * seniority-rank.ts is where that sequence is written down.
 *
 * The values are DERIVED, which no other group's are -- see seniority.ts. The
 * panel does not need to know that and deliberately does not say it: an option
 * here behaves like an option anywhere.
 */
export const SENIORITY: FacetGroupSpec = {
  key: "seniority",
  legend: "Seniority",
  plural: "seniority levels",
};

export const TEAM: FacetGroupSpec = {
  key: "team",
  legend: "Team",
  plural: "teams",
};

// SECOND FROM LAST, AND IT IS HERE BECAUSE THE ROLE PAGES LINK TO IT
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
// Near the bottom of the panel, not beside Work type, even though the two are
// the same shape. Position here is how often a question is asked, and this one
// is asked least; the lists above it are the ones people came for. Only
// Seniority is below it, and that is a group whose own note explains why.
export const BUSINESS_UNIT: FacetGroupSpec = {
  key: "businessUnit",
  legend: "Business unit",
  plural: "business units",
};
