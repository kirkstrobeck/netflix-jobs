import { CATEGORIES, PASSING } from "./config.mjs";

// Lighthouse's own rounding. A category at 0.994 is a 99 in the report and has
// to be a 99 here too, or the gate would pass things the report calls failures.
export const toScore = (value) => Math.round((value ?? 0) * 100);

const SKIPPED = new Set(["notApplicable", "informative", "manual"]);

const pad = (text, width) => String(text).padEnd(width);

export function scoreTable(results) {
  const width = Math.max(...CATEGORIES.map((id) => id.length));
  const lines = [];

  for (const result of results) {
    lines.push("", result.label, "-".repeat(result.label.length));
    for (const id of CATEGORIES) {
      const score = toScore(result.scores[id]);
      const mark = score >= PASSING ? "ok" : "FAIL";
      lines.push(`  ${pad(id, width)}  ${String(score).padStart(3)}  ${mark}`);
    }
  }

  return lines.join("\n");
}

// Everything a category counted and did not give full marks to. notApplicable
// and informative audits are dropped because they carry no weight -- listing
// them next to a failure sends whoever reads this off after audits that cannot
// move the number.
export function failingAudits(lhr, categoryId) {
  const category = lhr.categories[categoryId];

  return category.auditRefs
    .map((ref) => ({ ref, audit: lhr.audits[ref.id] }))
    .filter(({ audit }) => audit && !SKIPPED.has(audit.scoreDisplayMode))
    .filter(({ audit }) => (audit.score ?? 1) < 1)
    .map(({ ref, audit }) => ({
      id: audit.id,
      title: audit.title,
      score: audit.score,
      weight: ref.weight,
      displayValue: audit.displayValue,
      items: audit.details?.items?.length ?? 0,
    }));
}

export function explainFailures(results) {
  const lines = [];

  for (const result of results) {
    for (const id of CATEGORIES) {
      if (toScore(result.scores[id]) >= PASSING) {
        continue;
      }

      lines.push("", `${result.label} / ${id}`);
      for (const audit of failingAudits(result.lhr, id)) {
        const detail = audit.displayValue ? ` (${audit.displayValue})` : "";
        const items = audit.items ? ` [${audit.items} items]` : "";
        lines.push(
          `  ${audit.id}  score=${audit.score} weight=${audit.weight}${detail}${items}`,
        );
      }
    }
  }

  return lines.join("\n");
}
