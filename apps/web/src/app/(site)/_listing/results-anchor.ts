/**
 * Where a page change lands: the "Open roles" heading.
 *
 * One string, in its own module, because it is a JOIN between three files that
 * must not drift -- the heading that carries the id (listing.tsx), the page
 * links that end in `#open-roles` (pagination.tsx), and the scroll-margin that
 * keeps the heading off the top edge of the viewport when the browser jumps to
 * it (jobs-listing.css). Importing it from either component would point the
 * dependency the wrong way round or make a cycle.
 *
 * The scroll itself is the browser's. A fragment plus scroll-margin-block-start
 * is the whole mechanism: no scrollIntoView, no measuring, nothing to keep in
 * step with the layout, and it works identically with JavaScript off, where the
 * page link is a real navigation to a real URL ending in this id.
 */
export const RESULTS_ANCHOR = "open-roles";
