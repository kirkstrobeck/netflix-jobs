"use client";

import { useId, useState } from "react";

import { useQueryNavigation } from "@/app/(site)/_listing/use-query-navigation";
import { addKeyword, removeKeyword, type JobQuery } from "@/lib/search/job-query";

// Free text, added as chips. A form rather than a bare input so Enter submits
// the way the keyboard expects and the browser's own "search" affordances work;
// preventDefault keeps the navigation on the client router instead of a reload.
export function KeywordFacet({ query }: { query: JobQuery }) {
  const [draft, setDraft] = useState("");
  const navigate = useQueryNavigation();
  const inputId = useId();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    // addKeyword ignores blanks and repeats, so the guard lives in one place
    // and this only has to decide whether to clear the box.
    navigate(addKeyword(query, draft));
    setDraft("");
  };

  return (
    <div className="facet">
      <form className="facet__form" onSubmit={submit} role="search">
        <label className="facet__legend" htmlFor={inputId}>
          Keywords
        </label>

        <div className="keyword__entry">
          <input
            autoComplete="off"
            className="facet__search"
            id={inputId}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a keyword"
            type="search"
            value={draft}
          />
          <button className="keyword__add" type="submit">
            Add
          </button>
        </div>
      </form>

      {query.keywords.length === 0 ? null : (
        <ul className="chips">
          {query.keywords.map((keyword) => (
            <li key={keyword}>
              {/* An explicit name, not one composed from the children: the
                  button has to announce what it DOES, and "design" on its own
                  would read as a button called "design". */}
              <button
                aria-label={`Remove keyword: ${keyword}`}
                className="chip"
                onClick={() => navigate(removeKeyword(query, keyword))}
                type="button"
              >
                <span className="chip__text">{keyword}</span>
                <span aria-hidden="true" className="chip__cross">
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
