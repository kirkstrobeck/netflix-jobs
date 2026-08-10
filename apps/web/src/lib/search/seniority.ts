import type { SeniorityLevel } from "@/lib/search/seniority-rank";

// THE ONE FACET THE BOARD DOES NOT HAND US
//
// Every other facet reads a column. `team`, `business_unit` and `work_type` are
// non-null on all 481 active rows, and country and site resolve through the
// locations table. Seniority has no column, no key in the Eightfold `raw`
// payload, and no entry in its `custom_JD.data_fields` -- which carry exactly
// team, work_type, job_req_id, posting_date and an empty requisition_type. So
// the only place a level is written down is the title, and this file is the one
// place that reads it.
//
// PRECISION OVER RECALL, AND THE FALL-THROUGH IS THE PRICE
//
// A derived facet can be wrong in two ways, and they do not cost the same. A
// title that lands in no bucket is a role that does not show up under a level
// filter -- annoying, and honest. A title that lands in the WRONG bucket puts a
// people-manager posting in front of someone filtering for senior IC work, and
// they cannot tell it happened. So every rule below fires on a marker the title
// states outright, and anything unmarked gets no level rather than a guess.
//
// What that costs, measured against the 481 live postings: 139 of them (28.9%)
// carry no level marker at all. "Product Manager, Personalization", "Counsel,
// Experiences", "Storyboard Artist- Ink", "Treasury Analyst" -- real roles, at a
// real level, with nothing in the string that says which. Those offer no value
// to this facet, exactly as a job with a null `team` would offer none to that
// one, and they are counted in no option.

// The rungs themselves -- their sequence and their names -- are seniority-rank.ts.
// This file only READS titles, and the order it lists rungs in below is matcher
// precedence, which is the ladder upside down: a title states its highest rung,
// so staff has to be tried before senior. Keeping the two orders in two files is
// what stops one being mistaken for the other.
export type { SeniorityLevel };

/**
 * The management track, which wins outright when it matches.
 *
 * "Director" ALONE IS NOT A LEVEL HERE. Eighteen titles hold the word and only
 * eight of them are leadership: "Art Director - Ink", "Studio Creative
 * Director", "Technical Director Lighting - Netflix Animation Studios" and the
 * rest of the animation craft ladder use it as the name of a discipline. Reading
 * those as executives would file a compositing lead under the same option as the
 * Director of Enterprise Security. So the leadership form is the one Netflix
 * actually writes for it -- the word at the front, "Director, <org>" -- plus the
 * handful of function-scoped spellings.
 *
 * `Manager` is the same trap and worse: 178 titles contain it, and most are
 * individual contributors. "Product Manager", "Program Manager", "Account
 * Manager", "Artist Manager", "Technical Program Manager" are the job, not the
 * rung. The reliable signal is again positional -- "Manager, <org>" and its
 * senior form -- with "Engineering Manager" as the one <discipline> Manager
 * spelling that is unambiguous on this board, and "Head of" and "Supervisor"
 * beside them. Every other `<something> Manager` falls through on purpose.
 */
const TRACKS: [SeniorityLevel, RegExp][] = [
  [
    "director",
    /^director\b|\b(vice president|vp)\b|\bchief \w+ officer\b|\b(finance|managing|regional|executive) director\b/i,
  ],
  [
    "manager",
    /^(sr\.?|senior)?\s*manager\b|^head of\b|\bengineering manager\b|\bsupervisor\b/i,
  ],
];

/**
 * The individual-contributor ladder as a word, for the titles with no number.
 *
 * Ordered high to low, because a title states its highest rung: "Staff ML
 * Software Engineer (L6)" is staff, and "Associate Counsel" is entry even though
 * counsel is a senior profession.
 */
const WORDS: [SeniorityLevel, RegExp][] = [
  ["staff", /\b(staff|principal|distinguished|fellow)\b/i],
  ["senior", /\b(senior|sr\.?)\b/i],
  [
    "entry",
    /\b(intern|internship|apprentice|co-?op|junior|jr\.?|associate|coordinator|assistant|trainee)\b/i,
  ],
];

/**
 * The numeric ladder, which is Netflix's own vocabulary for this.
 *
 * 130 of the 481 titles carry it, in four spellings that all mean one thing:
 * "Software Engineer 5", "Software Engineer (L6)", "Staff ML Software Engineer
 * (L6)", "Machine Learning Scientist (L6)". Observed values are 3, 4, 5 and 6 --
 * one 3, nineteen 4s, sixty-four 5s and seventeen 6s by bare digit, plus 25 more
 * in the parenthesised L form.
 *
 * 1 AND 2 ARE DELIBERATELY NOT IN THE CLASS. No posting uses them as a level,
 * and matching them made "Launch Manager (1-Year Fixed-Term Contract)" an
 * entry-level role -- a contract length read as a rung. A digit is only a level
 * when it is one the ladder actually has.
 */
const RUNGS: Record<string, SeniorityLevel> = {
  "3": "entry",
  "4": "mid",
  "5": "senior",
  "6": "staff",
};

// Nine postings are open at two rungs at once -- "Distributed Systems Engineer
// 4/5", "Research Scientist 5/6" -- and they are two answers, not a range to be
// collapsed. The capture group is optional so the same pattern reads both.
//
// The boundaries are spelled out rather than left to \b, which does not fire
// between a space and a digit the way the eye expects, and because the
// separators on this board include the en dash and the em dash as often as the
// hyphen.
const NUMERIC = /(?:^|[\s(/–—-])l?([3-6])(?:\s*\/\s*l?([3-6]))?(?=$|[\s),/–—-])/i;

function numericLevels(title: string): SeniorityLevel[] {
  const found = NUMERIC.exec(title);

  if (!found) {
    return [];
  }

  const rungs = [found[1], found[2]]
    .filter((digit): digit is string => digit !== undefined)
    .map((digit) => RUNGS[digit]);

  return [...new Set(rungs)];
}

/**
 * The levels one title states, highest-confidence signal first.
 *
 * A list rather than a value, so it is the same shape as every other entry in
 * the job index: a single-rung title is a list of one, an unlevelled title is
 * empty, and the 4/5 postings are genuinely two. Counting and matching then
 * treat this facet identically to the five that came before it.
 */
export function seniorityLevels(title: string): SeniorityLevel[] {
  const track = TRACKS.find(([, pattern]) => pattern.test(title));

  if (track) {
    return [track[0]];
  }

  const numeric = numericLevels(title);

  if (numeric.length > 0) {
    return numeric;
  }

  const word = WORDS.find(([, pattern]) => pattern.test(title));

  if (word) {
    return [word[0]];
  }

  return [];
}
