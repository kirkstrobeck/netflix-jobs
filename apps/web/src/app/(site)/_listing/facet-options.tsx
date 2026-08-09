"use client";

import type { FacetOption } from "@/lib/search/facet-counts";

/**
 * How many options a facet shows before the rest go behind a disclosure.
 *
 * 5, chosen against the real data rather than as a round number. The five
 * largest of the 31 teams account for 264 of 481 postings, and the five largest
 * of the 40 locations are the four US hubs plus Vancouver -- so the default
 * slice answers most of what anyone comes to filter by. Work type has exactly
 * two values and so never shows the control at all.
 *
 * Five rows per group is also what lets all three groups -- work type, team,
 * location -- stand open beside the first screen of results at once, which is
 * the point of cutting eight down to five: the panel is a summary of the board
 * rather than one long team list with everything else below the fold. Past the
 * fifth row, the search box above each group is the faster route anyway.
 */
export const VISIBLE_OPTIONS = 5;

type FacetOptionsProps = {
  options: FacetOption[];
  /** The group's name as a plural noun, for "Show all 31 locations". */
  plural: string;
  onToggle: (value: string) => void;
};

function Option({
  option,
  onToggle,
}: {
  option: FacetOption;
  onToggle: (value: string) => void;
}) {
  return (
    <li>
      <label className={option.selected ? "option option--on" : "option"}>
        <input
          checked={option.selected}
          className="option__box"
          onChange={() => onToggle(option.value)}
          type="checkbox"
        />
        <span className="option__label">{option.label}</span>
        {/* aria-hidden: the label already names the option, and "Engineering 96"
            read as one string is worse than the checkbox's own name. The number
            is visual shorthand. */}
        <span aria-hidden="true" className="option__count">
          {option.count}
        </span>
      </label>
    </li>
  );
}

// A selected option is always in the open list, wherever it sits in the order.
// Leaving it behind the disclosure would hide the only control that could clear
// it, and the list does not reorder to achieve that -- the slice is widened, not
// sorted, so nothing moves under the pointer as boxes are ticked.
const isOpen = (option: FacetOption, index: number) =>
  index < VISIBLE_OPTIONS || option.selected;

/**
 * The top five, and a <details> holding the rest.
 *
 * No state and no JavaScript: <details> is the disclosure, the summary is its
 * own button, and the browser announces expanded/collapsed without an
 * aria-expanded to keep in step. The two summary labels are both in the markup
 * and CSS shows one of them, so the label tells the truth in either state
 * without anything having to re-render.
 */
export function FacetOptions({ options, plural, onToggle }: FacetOptionsProps) {
  const open = options.filter(isOpen);
  const rest = options.filter((option, index) => !isOpen(option, index));

  return (
    <>
      <ul className="facet__options">
        {open.map((option) => (
          <Option key={option.value} onToggle={onToggle} option={option} />
        ))}
      </ul>

      {rest.length > 0 ? (
        <details className="facet__rest">
          {/* Sentence case, and the count is the useful half of the promise: the
              difference between opening two more rows and opening twenty-nine. */}
          <summary className="facet__more">
            <span className="facet__more-all">
              Show all {options.length} {plural}
            </span>
            <span className="facet__more-fewer">Show fewer {plural}</span>
          </summary>

          <ul className="facet__options facet__options--rest">
            {rest.map((option) => (
              <Option key={option.value} onToggle={onToggle} option={option} />
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
