// Sentence case per .cursor/rules/ui-style-guide.mdc: the string is "New" and
// the uppercase is a text-transform in posted-badge.css, where the rest of the
// badge -- red fill, white text, rounded corners -- lives too.
export function NewBadge() {
  return <span className="posted-badge">New</span>;
}
