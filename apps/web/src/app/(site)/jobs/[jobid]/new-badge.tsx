// Sentence case per .cursor/rules/ui-style-guide.mdc: the string is "New" and
// the uppercase is a text-transform in job-hero.css -- the same treatment
// .eyebrow gets, which is what makes this read as part of the page rather than
// as a pill dropped on top of it.
export function NewBadge() {
  return <span className="posted-badge">New</span>;
}
