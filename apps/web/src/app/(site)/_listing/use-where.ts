"use client";

import { useEffect, useRef, useState } from "react";

import { countryCode } from "@/lib/geo/country-code";

/**
 * The country the edge thinks this request came from, fetched after paint.
 *
 * It starts null and stays null until the answer lands, which is what keeps
 * this out of the shell: the server renders no place, the first client render
 * renders no place, hydration matches, and the country arrives afterwards as a
 * refinement to one line of text. Nothing waits for it and nothing is
 * suspended on it -- a heading is not worth a blocked paint.
 *
 * ASKED ONCE, AND ONLY WHEN THE ANSWER COULD MATTER
 *
 * `wanted` is false on the newest listing and on any listing whose URL already
 * names a country, because in both cases there is nothing the answer could
 * change. The ref then makes it once per page rather than once per state
 * change: switching Nearest -> Newest -> Nearest is not three requests, and the
 * answer cannot have changed in between anyway.
 *
 * Every failure is the same failure. A network error, a 500, a body that is not
 * what it should be, a country code that is not one: all of them leave this
 * null, and the heading says nothing rather than something wrong.
 */
export function useWhere(wanted: boolean): string | null {
  const [country, setCountry] = useState<string | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (!wanted || asked.current) {
      return;
    }

    asked.current = true;

    let live = true;

    fetch("/api/where")
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { country?: unknown } | null) => {
        if (live) {
          setCountry(countryCode(typeof body?.country === "string" ? body.country : null));
        }
      })
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, [wanted]);

  return country;
}
