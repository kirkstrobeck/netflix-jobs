import Link from "next/link";

// Text wordmark rather than an image: nothing to download, nothing to reserve
// space for, and no chance of a logo popping in after paint.
export function SiteHeader() {
  return (
    <header className="site-header">
      <a className="skip-link" href="#job-main">
        Skip to job details
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
