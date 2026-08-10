/**
 * THE LADDER, IN LADDER ORDER, WRITTEN DOWN ONCE.
 *
 * Seniority is the one ORDINAL facet on this panel. Location, team, work type
 * and business unit are nominal -- "Canada" is not more or less than "Poland"
 * -- so the only ranking those have is how many roles are behind them, and they
 * keep their count-descending sort. A level is different: entry really does come
 * before staff, every reader already knows the sequence, and a list that opens
 * "Entry level, Staff and principal, Mid level" because that happens to be the
 * count order reads as broken data rather than as a popularity ranking.
 *
 * So the rungs are an ARRAY and their index is their rank. Splitting them out of
 * seniority.ts is what makes that one definition: that file reads a level off a
 * title and has its own reasons to list the rungs in matcher-precedence order
 * (highest first, so "Staff ML Engineer (L6)" is staff and not senior), and the
 * two orders are not the same order. Anything that needs to SEQUENCE levels --
 * the facet list today, a grouped view or a level sort tomorrow -- reads
 * seniorityRank from here instead of hard-coding a second opinion.
 *
 * The labels travel with the rungs for the same reason: the URL carries the slug
 * and the panel shows the label, and a rung that exists in one list and not the
 * other is a ticked box with no name on it. One array, so there is no second
 * list to keep in step.
 *
 * Sentence case, per .cursor/rules/ui-style-guide.mdc.
 */
const LADDER = [
  { level: "entry", label: "Entry level" },
  { level: "mid", label: "Mid level" },
  { level: "senior", label: "Senior" },
  { level: "staff", label: "Staff and principal" },
  // The management track sits above the IC ladder rather than beside it. It is
  // one column of checkboxes and it has to have an order; a manager outranks a
  // staff IC often enough, and reads as a promotion from one nowhere near often
  // enough to be worth a second axis on a job board's sidebar.
  { level: "manager", label: "Manager" },
  { level: "director", label: "Director and above" },
] as const;

export type SeniorityLevel = (typeof LADDER)[number]["level"];

export const SENIORITY_LABELS: Record<SeniorityLevel, string> = Object.fromEntries(
  LADDER.map((rung) => [rung.level, rung.label]),
) as Record<SeniorityLevel, string>;

const RANKS = new Map<string, number>(LADDER.map((rung, index) => [rung.level, index]));

/**
 * Where a value sits on the ladder, as a number a comparator can subtract.
 *
 * A string the ladder does not hold ranks after every rung it does -- the same
 * answer labelFor gives it, which is to render it as itself. `?level=archmage`
 * is a box someone typed into the address bar and it still has to be a box they
 * can untick, so it sorts to the bottom rather than being dropped or throwing.
 */
export function seniorityRank(value: string): number {
  return RANKS.get(value) ?? LADDER.length;
}
