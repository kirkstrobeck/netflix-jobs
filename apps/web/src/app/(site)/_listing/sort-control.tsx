"use client";

import { useId } from "react";

import { QueryLink } from "@/app/(site)/_listing/query-link";
import { useQueryNavigation } from "@/app/(site)/_listing/use-query-navigation";
import { withSort, type JobQuery } from "@/lib/search/job-query";
import type { SortOrder } from "@/lib/search/sort-order";

type SortControlProps = {
  query: JobQuery;
  /** Pressed when Nearest is chosen, and only then. Raises the prompt. */
  onNearest: () => void;
};

const OPTIONS: { sort: SortOrder; label: string }[] = [
  { sort: "newest", label: "Newest" },
  { sort: "nearest", label: "Nearest" },
];

/**
 * The order control, sitting to the right of "Open roles" on the same line.
 *
 * LINKS, NOT RADIOS
 *
 * Every other selection on this page is a checkbox, because a facet is a set of
 * independent yes/no answers and a checkbox is what that is. This is a
 * different question: two mutually exclusive views, each of which is a real
 * address someone can send to someone else. Radios can express the exclusivity
 * but not the address -- they would need JavaScript to reach a URL at all,
 * which would make a sorted link something only a scripted browser can follow,
 * and Nearest is precisely the option a shared link has to survive.
 *
 * So each option is an anchor with the href it would have. QueryLink intercepts
 * the plain click and keeps it on the client; a middle click opens the sorted
 * view in a tab, and with JavaScript off the link still navigates and still
 * lands on a newest-ordered list, which is what the server would have rendered
 * anyway.
 *
 * aria-current="true", not "page": these are items in a set, not the page you
 * are on. The pager uses "page" for the thing that genuinely is one.
 *
 * EXACTLY ONE IS ALWAYS CHOSEN
 *
 * `query.sort` is a two-valued enum that parseSort resolves everything into --
 * a missing param, an old spelling, junk -- so one option matches and one does
 * not, on the server, on the client, and with JavaScript off. There is no
 * "neither" state to render and no way to reach a "both".
 *
 * Newest is the one spelled by SILENCE: it is the default, so its href is the
 * URL with no sort param at all, and only `?sort=near` is ever written. That is
 * what makes the pair readable from a bare `/`.
 *
 * WHEN NEAREST IS CHOSEN AND THE LIST IS NOT SORTED BY DISTANCE
 *
 * The control still reads Nearest, and SortStatus under it says the list is
 * ordered newest first and why. The alternative -- rewriting the address to
 * newest when the position is refused -- was rejected: it is the page overruling
 * a choice the visitor made, on the strength of a permission answer, and it
 * would quietly rewrite a shared `?sort=near` link into one that no longer asks
 * for anything. The URL records what was ASKED for, this control reads it back,
 * and the status line says what is actually on screen. Nothing lies, and nothing
 * the visitor did is undone behind their back.
 *
 * A CONTROL, NOT A HEADING
 *
 * "Open roles" is a 0.8125rem uppercase label naming the column. This has to
 * read as something you can press instead: same type size so the header line
 * holds, but boxed, with a hairline around the pair and the chosen half filled
 * in. The weight comes from the border and the fill, not from making the text
 * bigger, which would put a second heading on the line.
 */
export function SortControl({ query, onNearest }: SortControlProps) {
  const labelId = useId();
  const navigate = useQueryNavigation();

  // Asking for the position and changing the URL are one action, and they
  // happen in this order inside the click itself. Not in an effect watching
  // `sort` -- an effect would raise the prompt whenever the URL said `near`,
  // including on a back button and on a shared link, which is the thing that
  // must not happen. getCurrentPosition is therefore reached synchronously from
  // the handler, while the press is still the reason it is being called.
  const follow = (sort: SortOrder) => (next: JobQuery) => {
    if (sort === "nearest") {
      onNearest();
    }

    navigate(next);
  };

  return (
    <div className="sort">
      {/* A span, not a <legend> or an <h*>. It names the group for a screen
          reader via aria-labelledby below; making it a heading would put "Sort"
          in the document outline next to "Open roles", which is two headings
          for one line of a page that has one h1 already. */}
      <span className="sort__label" id={labelId}>
        Sort
      </span>

      <div aria-labelledby={labelId} className="sort__options" role="group">
        {OPTIONS.map((option) => (
          <QueryLink
            className="sort__option"
            current={query.sort === option.sort ? "true" : undefined}
            key={option.sort}
            onFollow={follow(option.sort)}
            query={withSort(query, option.sort)}
          >
            {option.label}
          </QueryLink>
        ))}
      </div>
    </div>
  );
}
