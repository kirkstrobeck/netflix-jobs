"use client";

import { useCallback } from "react";

import { useQueryNavigation } from "@/app/(site)/_listing/use-query-navigation";
import { rememberCountry } from "@/lib/geo/country-cookie";
import type { JobQuery } from "@/lib/search/job-query";

/**
 * Navigate, and write down that the visitor chose this country themselves.
 *
 * Every control that can change the country goes through here, and NOTHING else
 * does. That is the line between a country the visitor picked and one that was
 * picked for them: if plain navigate() wrote the cookie, then filtering by team
 * on a first load would quietly promote the detected country into a remembered
 * choice, and detection would become permanent the first time anyone clicked
 * anything. Sticky detection is the failure this whole arrangement is built to
 * avoid, so the write is scoped to the two controls that actually ask the
 * question: the country boxes, and Clear all.
 */
export function useCountryChoice(): (query: JobQuery) => void {
  const navigate = useQueryNavigation();

  return useCallback(
    (next: JobQuery) => {
      rememberCountry(next.country);
      navigate(next);
    },
    [navigate],
  );
}
