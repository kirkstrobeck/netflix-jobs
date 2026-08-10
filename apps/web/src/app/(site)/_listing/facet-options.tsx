"use client";

import type { ReactNode } from "react";

import {
  hiddenOptions,
  shownOptions,
} from "@/app/(site)/_listing/facet-disclosure";
import { OptionCount } from "@/app/(site)/_listing/option-count";
import type { FacetOption } from "@/lib/search/facet-counts";

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
  /** The group's name as a plural noun, for "Show 16 more locations". */
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
        <OptionCount count={option.count} />
      </label>

      {/* Outside the <label>, deliberately. A label's implicit control is the
          first one inside it, so nesting a second set of checkboxes in there
          would make clicking an office toggle its country instead. */}
      {renderNested?.(option)}
    </li>
  );
}

/**
 * The top five, and a <details> holding the rest -- or the whole list and no
 * control at all.
 *
 * Which of those it is comes from facet-disclosure.ts, which owns both the
 * cut-off and the "at least three, or show everything" rule. Work type has two
 * values and never shows the control; a group whose sixth option is its last
 * two does not show it either.
 *
 * The OFFICES under a country never reach here and show in full: seventeen of
 * the 21 countries have exactly one, and the ten under the United States only
 * appear once it has been ticked -- by which point the visitor has asked this
 * exact question.
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
  const open = shownOptions(options);
  const rest = hiddenOptions(options);
  // What opening it costs, not what the list totals. "Show all 21 locations"
  // made the reader do the subtraction to find out whether this was two more
  // rows or sixteen -- and it did the subtraction WRONG whenever a selected
  // option had already been pulled up out of the tail, because the open list was
  // six rows and the promise still counted twenty-one. rest.length is by
  // construction exactly what is behind the control, in every state.
  //
  // Always the plural. There used to be a singular branch for "1 more team", and
  // the three-row floor is what deleted it: a tail of one or two is not folded
  // away at all now, so the smallest number this string can ever carry is 3.
  const more = `${rest.length} more ${plural}`;

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
            <span className="facet__more-all">Show {more}</span>
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
