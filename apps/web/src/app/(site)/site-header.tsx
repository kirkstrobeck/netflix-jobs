import { Wordmark } from "@/app/(site)/wordmark";

// The official mark, not the word set in type, in Netflix red on flat
// --surface, where #e50914 measures 4.30:1. The footer carries the same file --
// site-footer.css records the measurement that says it can.
//
// It is a 1.5KB SVG with its aspect ratio declared, so "nothing to reserve space
// for" -- the reason this used to be text -- is handled by next/image reserving
// it, and loading="eager" keeps the mark from arriving late above the fold.
export function SiteHeader() {
  return (
    <header className="site-header">
      {/* "Skip to job details" while this header only ever sat above a posting.
          It sits above the home page too now, where that label described a page
          the link does not go to. */}
      <a className="skip-link" href="#site-main">
        Skip to main content
      </a>
      <div className="shell site-header__inner">
        <Wordmark className="wordmark" loading="eager" />
      </div>
    </header>
  );
}
