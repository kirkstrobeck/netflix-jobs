import "@/app/foo/page.css";

// /foo is the scratch route -- it held a bare <Glow /> so the effect could be
// looked at outside the footer that owns it. Nothing else imported it from here,
// and site-footer.tsx still mounts <Glow />, so replacing the page loses nothing.
//
// The root layout already paints <html> and <body> black, so .foo-field's own
// background is technically redundant. It is declared anyway: this route is a
// prototype surface whose whole point is that what you see is what this file
// says, not what an ancestor happens to be doing.
export default function Base() {
  return (
    <div className="foo-field">
      <div className="foo-band" />
    </div>
  );
}
