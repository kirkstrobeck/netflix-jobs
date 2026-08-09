import { EVERYWHERE, PARAM } from "@/lib/search/job-query";
import { DEFAULT_SORT, parseSort, sortParam } from "@/lib/search/sort-order";

/**
 * The two words the listing's URL no longer says, unspelled.
 *
 * toSearchParams cannot produce either of them, so nothing we link to is ever
 * wrong. This is for the URLs we do not write: a link copied out of a message
 * six months ago, a bookmark, a crawler's index, someone typing by hand. Those
 * arrive spelling the defaults out loud, and a default spelled out loud is a
 * second address for a page that already has one.
 *
 * It is a REDIRECT rather than a quiet re-render, for the same reason the
 * country hop is one: the address bar is part of what the page says, and a page
 * that renders the newest list while the URL claims a sort is the URL and the
 * screen disagreeing. proxy.ts runs this before anything is rendered, so the
 * correction arrives before the first byte instead of after it.
 *
 * IT IS A FIXED POINT
 *
 * Everything it returns is already canonical -- `sort` is either absent or
 * `near`, and `country` never holds `all` -- so running it on its own output
 * returns null and there is no second hop.
 *
 * Everything it does not model is carried across untouched. `?utm_source=` and
 * `?src=test` are not ours to tidy, and a redirect that eats the campaign that
 * sent someone here is a redirect that costs money.
 */

// Newest is the default, so it is spelled by leaving `sort` off entirely --
// which makes `near` the only value the URL ever carries. Anything else is a
// spelling of newest: `new`, `newest`, and whatever an old link or a typo
// holds, since parseSort resolves everything it does not recognise to the
// default rather than to an error.
//
// set(), not delete-then-append: it replaces the first occurrence in place, so
// `?sort=near&country=US` keeps its order and does not redirect to itself
// rewritten.
function applySort(params: URLSearchParams): void {
  const raw = params.getAll(PARAM.sort);

  if (raw.length === 0) {
    return;
  }

  const sort = parseSort(raw[0]);

  if (sort === DEFAULT_SORT) {
    params.delete(PARAM.sort);
    return;
  }

  params.set(PARAM.sort, sortParam(sort));
}

// `country=all` named no country and said what a bare `/` already shows. The
// value is dropped and any real country beside it is kept, so a hand-written
// `?country=all&country=JP` resolves to Japan rather than to an argument.
function applyEverywhere(params: URLSearchParams): void {
  const countries = params.getAll(PARAM.country);
  const kept = countries.filter((code) => code.trim().toLowerCase() !== EVERYWHERE);

  if (kept.length === countries.length) {
    return;
  }

  params.delete(PARAM.country);
  kept.forEach((code) => params.append(PARAM.country, code));
}

/**
 * The canonical spelling of this query string, or null if it is already it.
 *
 * The empty string is a real answer and is not null: it is what `?country=all`
 * canonicalises to, and the caller has to be able to redirect to a bare path.
 */
export function canonicalSearch(search: URLSearchParams): string | null {
  const params = new URLSearchParams(search);

  applySort(params);
  applyEverywhere(params);

  const next = params.toString();

  if (next === search.toString()) {
    return null;
  }

  if (!next) {
    return "";
  }

  return `?${next}`;
}
