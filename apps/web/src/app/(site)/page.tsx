// The home page is the standard shell and nothing else. It used to hand-roll its
// own full-bleed ambient band -- a <video> plus a black overlay gradient, the
// same pair the footer carried -- so the site drew the same effect twice, two
// different ways, and the home page's copy was the one nobody else could reuse.
//
// Both are gone. The layout's <SiteFooter /> brings the glow with it, which is
// why there is no <Glow /> here: the footer owns it, a page never mounts it
// directly, and a page that did would end up with two.
//
// So this renders no visible content yet, only the heading the document needs.
// A <main> with nothing in it is still a landmark a screen reader will announce,
// and the h1 is what gives it a name -- and gives the page an outline that is not
// simply missing while the content is still to come.
export default function Home() {
  return <h1 className="visually-hidden">Careers at Netflix</h1>;
}
