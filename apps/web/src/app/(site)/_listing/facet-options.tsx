"use client";

import type { ReactNode } from "react";

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
 * click away rather than sixteen rows down the panel. Work type has exactly two
 * values and so never shows the control at all.
 *
 * The OFFICES under a country are the deliberate exception and show in full.
 * Seventeen of the 21 countries have exactly one, and a "show all 1 sites"
 * disclosure over a single row is a control that costs a click to reveal
 * nothing. Only the United States has more than three, and its ten only appear
 * after the country has been ticked -- by which point the visitor has asked
 * this exact question and hiding half the answer is the wrong instinct.
 *
 * Five rows per group is also what lets every group stand open beside the first
 * screen of results at once: the panel is a summary of the board rather than
 * one long team list with everything else below the fold. Past the fifth row,
 * the search box above each group is the faster route anyway.
 */
export const VISIBLE_OPTIONS = 5;

/**
 * What hangs UNDER one option, if anything.
 *
 * The country facet is the only caller that passes one, and it uses it for the
 * offices inside a ticked country. It is a slot rather than a second list
 * component because the top-five-and-a-disclosure rule below has to keep
 * applying to the parent list: a country that is selected is always on screen,
 * and its offices have to come with it wherever it sits in the order.
 */
type RenderNested = (option: FacetOption) => ReactNode;

type FacetOptionsProps = {
  options: FacetOption[];
  /** The group's name as a plural noun, for "Show all 31 locations". */
  plural: string;
  onToggle: (value: string) => void;
  renderNested?: RenderNested;
};

function Option({
  option,
  onToggle,
  renderNested,
}: {
  option: FacetOption;
  onToggle: (value: string) => void;
  renderNested?: RenderNested;
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

      {/* Outside the <label>, deliberately. A label's implicit control is the
          first one inside it, so nesting a second set of checkboxes in there
          would make clicking an office toggle its country instead. */}
      {renderNested?.(option)}
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
export function FacetOptions({
  options,
  plural,
  onToggle,
  renderNested,
}: FacetOptionsProps) {
  const open = options.filter(isOpen);
  const rest = options.filter((option, index) => !isOpen(option, index));

  return (
    <>
      <ul className="facet__options">
        {open.map((option) => (
          <Option
            key={option.value}
            onToggle={onToggle}
            option={option}
            renderNested={renderNested}
          />
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
              <Option
                key={option.value}
                onToggle={onToggle}
                option={option}
                renderNested={renderNested}
              />
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
