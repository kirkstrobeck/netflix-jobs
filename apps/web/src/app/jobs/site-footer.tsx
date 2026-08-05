import "@/app/jobs/site-footer.css";

// Deliberately NOT importing app/ambient-video.tsx. That file is the home page's
// own in-progress work and it is a client component built around a different
// need (matchMedia listeners, replay-on-ended). This footer needs a plain server
// rendered <video>, so the ~8 lines of markup are duplicated rather than coupling
// this route to a file that is actively being rewritten.
//
// Filenames carry a content hash: these are served immutable for a year, so
// re-encoding an asset requires a new hash or returning visitors keep the old file.
const POSTER = "/video/ambient-light-poster.dc7199e6.jpg";
const WEBM = "/video/ambient-light-footer.15f477f8.webm";
const MP4 = "/video/ambient-light-footer.fa761cec.mp4";

// Netflix's own careers footer, minus "Cookie Preferences". Theirs is href="#"
// wired to a consent modal; this app has no consent system, so shipping it would
// be a control that looks interactive and does nothing. Every link below is a
// real destination on an external origin, hence target/rel on all four.
const LINKS = [
  { label: "About Us", href: "https://about.netflix.com/en" },
  { label: "Privacy", href: "https://jobs.netflix.com/candidate-privacy" },
  { label: "Netflix House Jobs", href: "https://jobs.netflixhouse.com/" },
  {
    label: "Do Not Sell Or Share My Personal Information",
    href: "https://jobs.netflix.com/dnssi",
  },
];

// No "use client": autoplay/muted/loop/playsinline are declarative, so the band
// works from the server HTML with no hydration. Reduced motion is handled in CSS.
//
// The media layer is absolutely positioned, so it is outside layout entirely and
// cannot shift anything when the video paints. The band's height comes from this
// text plus an explicit min-block-size, both of which exist before any byte of
// video arrives.
export function SiteFooter() {
  return (
    <footer className="job-footer">
      <div aria-hidden="true" className="job-footer__media">
        <video
          aria-hidden="true"
          autoPlay
          className="job-footer__video"
          loop
          muted
          playsInline
          poster={POSTER}
          preload="metadata"
          tabIndex={-1}
        >
          <source src={WEBM} type="video/webm" />
          <source src={MP4} type="video/mp4" />
        </video>

        <div className="job-footer__scrim" />
      </div>

      <div className="shell job-footer__content">
        <h2 className="visually-hidden">Footer</h2>

        {/* Netflix buries this in grey fine print. It is an accommodation offer,
            so here it leads the footer at body-copy size with the accent rule
            the page already uses for pulled-out text. */}
        <p className="job-footer__notice">
          Inclusion is a Netflix value and we strive to host a meaningful
          interview experience for all candidates. If you want an
          accommodation/adjustment for a disability or any other reason during
          the hiring process, please send a request to your recruiting partner.
        </p>

        <nav aria-label="Footer">
          <ul className="job-footer__links">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  className="job-footer__link"
                  href={link.href}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
