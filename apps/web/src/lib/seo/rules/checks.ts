// Small predicates the rule files share. Everything takes `unknown`, because the
// point of the rules is to inspect a value nobody has proved anything about yet
// -- a JSON-LD block parsed back out of rendered HTML, or a builder's output
// treated as if it came from a stranger.

export type Node = Record<string, unknown>;

export function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// JSON-LD lets any property hold one value or an array of them, so every rule
// that walks into a property has to cope with both shapes.
export function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined) {
    return [];
  }

  return [value];
}

export function typeOf(value: unknown): string | null {
  if (!isNode(value)) {
    return null;
  }

  const type = value["@type"];

  return typeof type === "string" ? type : null;
}

export function isAbsoluteUrl(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  return /^https?:\/\/[^\s]+$/.test(value);
}

// ISO 8601 as Google's examples spell it: a bare date, or a date and time with an
// optional offset. "2017-01-24" and "2017-01-24T19:33:17+00:00" are both given as
// valid in the JobPosting reference.
const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

export function isIso8601(value: unknown): boolean {
  if (typeof value !== "string" || !ISO_8601.test(value)) {
    return false;
  }

  // A syntactically fine 2026-02-31 is still not a day.
  const [date] = value.split("T");
  const parsed = new Date(`${date}T00:00:00Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(date);
}

// Collects violations without a control-flow branch per check.
export function must(violations: string[], condition: boolean, message: string): void {
  if (!condition) {
    violations.push(message);
  }
}
