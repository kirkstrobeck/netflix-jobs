"use client";

import { useId, useState } from "react";

import type { FacetOption } from "@/lib/search/facet-counts";

/**
 * How many options a facet shows before "Show all".
 *
 * 8, chosen against the real data rather than as a round number. The eight
 * largest teams account for 331 of 481 postings, so the default slice answers
 * most of what anyone comes to filter by; work type has only two values and so
 * never shows the control at all; and eight rows is about the depth the panel
 * can hold beside the first result row without the two columns falling out of
 * step. Beyond that the search box above is the faster route anyway.
 */
export const VISIBLE_OPTIONS = 8;

type FacetOptionsProps = {
  options: FacetOption[];
  legend: string;
  onToggle: (value: string) => void;
};

// A selected option is always shown, wherever it sits in the order. Truncating
// it away would hide the only control that could clear it, and the list does not
// reorder to achieve that -- the slice is widened, not sorted, so nothing moves
// under the pointer as boxes are ticked.
function visibleOptions(options: FacetOption[], expanded: boolean): FacetOption[] {
  if (expanded) {
    return options;
  }

  return options.filter((option, index) => index < VISIBLE_OPTIONS || option.selected);
}

export function FacetOptions({ options, legend, onToggle }: FacetOptionsProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const shown = visibleOptions(options, expanded);
  const hidden = options.length - shown.length;

  return (
    <>
      <ul className="facet__options" id={listId}>
        {shown.map((option) => (
          <li key={option.value}>
            <label className={option.selected ? "option option--on" : "option"}>
              <input
                checked={option.selected}
                className="option__box"
                onChange={() => onToggle(option.value)}
                type="checkbox"
              />
              <span className="option__label">{option.label}</span>
              {/* aria-hidden: the label already names the option, and
                  "Engineering 96" read as one string is worse than the
                  checkbox's own name. The number is visual shorthand. */}
              <span aria-hidden="true" className="option__count">
                {option.count}
              </span>
            </label>
          </li>
        ))}
      </ul>

      {hidden > 0 || expanded ? (
        <button
          aria-controls={listId}
          aria-expanded={expanded}
          className="facet__more"
          onClick={() => setExpanded(!expanded)}
          type="button"
        >
          {/* The accessible name carries the group, since "Show all 31" alone
              tells a screen reader nothing about which list it opens. */}
          {expanded ? `Show fewer ${legend.toLowerCase()}` : `Show all ${options.length}`}
        </button>
      ) : null}
    </>
  );
}
