// A plain anchor, not a button: it navigates. Netflix red is used as a
// background with white text, which clears WCAG AA at 4.79:1 — the same red as
// small text on #080202 would only reach 4.3:1 and fail.
//
// What the fill cannot do is hold the button's own EDGE against the hero's
// bars, which are the same red. That is job-cta.css's problem and the numbers
// are there.
export function ApplyButton({ href, title }: { href: string; title: string }) {
  return (
    <a
      className="apply-button"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      Apply for this role
      <span className="visually-hidden">: {title}</span>
    </a>
  );
}
