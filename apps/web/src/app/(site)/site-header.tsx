import Link from "next/link";

// Text wordmark rather than an image: nothing to download, nothing to reserve
// space for, and no chance of a logo popping in after paint.
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
        <Link className="wordmark" href="/">
          Netflix
          <span className="wordmark__suffix">Jobs</span>
        </Link>
      </div>
    </header>
  );
}
