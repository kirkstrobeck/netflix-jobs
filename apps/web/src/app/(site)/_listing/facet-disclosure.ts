import type { FacetOption } from "@/lib/search/facet-counts";

/**
 * How many options a facet shows before the rest go behind a disclosure.
 *
 * 5, chosen against the real data rather than as a round number. The five
 * largest of the 31 teams account for 264 of 481 postings, and the five largest
 * of the 21 countries -- United States 303, Canada 35, Australia 22, Poland 22,
 * South Korea 19 -- account for 401 of them, with a tail of sixteen that
 * finishes on four countries holding one role each. That is the shape the
 * disclosure is for: a short answer to almost everyone, and the long tail one
 * click away rather than sixteen rows down the panel.
 *
 * Five rows per group is also what lets every group stand open beside the first
 * screen of results at once: the panel is a summary of the board rather than one
 * long team list with everything else below the fold.
 */
export const VISIBLE_OPTIONS = 5;

/**
 * The smallest tail worth folding away.
 *
 * A disclosure is a control: it takes a row of its own, it has to be found,
 * pressed and read, and it costs a click. Over one or two hidden rows it costs
 * all of that to save less vertical space than it occupies -- "Show 1 more
 * seniority level" is a button that is bigger than the thing behind it, and a
 * reader who presses it has been made to work for a row that would have fitted
 * on screen anyway. Three is where the tail is finally taller than the control
 * that hides it.
 *
 * The same number decides the option search above the list, and it is the same
 * FACT rather than a coincidence: a search box narrows a list to what you can
 * see, so a list that is already entirely on screen has nothing for it to do.
 * Both read `hiddenOptions` below, so the two can never disagree about whether
 * this group is showing everything.
 */
export const MIN_HIDDEN_OPTIONS = 3;

// A selected option is always in the open list, wherever it sits in the order.
// Leaving it behind the disclosure would hide the only control that could clear
// it, and the list does not reorder to achieve that -- the slice is widened, not
// sorted, so nothing moves under the pointer as boxes are ticked.
const beyondTheFold = (option: FacetOption, index: number) =>
  index >= VISIBLE_OPTIONS && !option.selected;

/**
 * The options this group does NOT show outright -- empty whenever it shows all
 * of them, and empty whenever the tail is too short to be worth a control.
 *
 * The one place the panel decides "is anything hidden here". Everything that
 * turns on that question -- whether to draw a disclosure, whether to draw the
 * option search, what number to promise in the summary -- reads this list rather
 * than counting rows again with its own threshold.
 */
export function hiddenOptions(options: FacetOption[]): FacetOption[] {
  const rest = options.filter(beyondTheFold);

  if (rest.length < MIN_HIDDEN_OPTIONS) {
    return [];
  }

  return rest;
}

/** The rows that are on screen: everything `hiddenOptions` did not take. */
export function shownOptions(options: FacetOption[]): FacetOption[] {
  const hidden = new Set(hiddenOptions(options));

  return options.filter((option) => !hidden.has(option));
}

/**
 * Whether this group is holding anything back.
 *
 * For the callers that only want the yes/no and never touch the rows -- the
 * option search is the one today. It is this function rather than a length
 * comparison at the call site so the answer comes from the same split the markup
 * is built from.
 */
export function hidesOptions(options: FacetOption[]): boolean {
  return hiddenOptions(options).length > 0;
}
