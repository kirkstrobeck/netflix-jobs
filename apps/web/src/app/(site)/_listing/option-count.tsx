/**
 * The number beside a facet option, written once.
 *
 * It was written twice -- here in the flat list and again in the offices nested
 * under a ticked country -- and both copies had the same two faults, which is
 * the argument for there being one of it.
 *
 * THE SPACE IS IN THE MARKUP
 *
 * The same bug as "Filters5 applied", "Team1 selected" and "2 days agoNew",
 * and the last one of the family: the option's two text runs were adjacent in
 * the DOM with nothing between them but .option's 0.5rem flex gap. A gap is not
 * a word separator. It is not in the accessible name, it is not in a text copy,
 * and it is not there at all before the stylesheet lands -- which is when the
 * row paints as "Onsite88".
 *
 * The `{" "}` is a whitespace-only run between two flex items, so flex layout
 * discards it and the optical spacing is still the gap's. Nothing moves; the
 * separation just exists somewhere other than the eye as well.
 *
 * AND IT IS SPOKEN, RATHER THAN SILENCED
 *
 * This used to carry aria-hidden, justified on the grounds that "Engineering
 * 96" is a worse accessible name than "Engineering". That was solving the wrong
 * half: aria-hidden made the glued string silent, not correct, and it took the
 * count -- the number that says whether ticking this box returns 303 roles or
 * one -- away from the only visitors who could not see it.
 *
 * So the number says what it counts instead. The digits stay visual shorthand
 * and the noun is for the name, which makes the checkbox announce "Engineering
 * 96 roles" -- a phrase rather than two things run together.
 *
 * THE NOUN IS A SIBLING OF THE NUMBER, NOT A CHILD OF IT
 *
 * Three serialisations had to come out separated, and only this arrangement
 * gets all three. Measured in Chromium against this page:
 *
 *   nested, `<span class=count>96<span hidden> roles</span></span>`
 *     textContent  "Onsite 96 roles"   accessible name  "Onsite 96roles"
 *     copied text  "Onsite\n96roles"
 *   nested with the space as its own run
 *     accessible name fixed, copied text still "Onsite\n96roles" -- the hidden
 *     span is position: absolute, so it is welded to the digits in the
 *     selection even though innerText breaks them
 *   sibling, as below
 *     textContent  "Onsite 96 roles"   accessible name  "Onsite 96 roles"
 *     copied text  "Onsite\n96\nroles"
 *
 * Name computation trims each node's text before joining, which is why the
 * spaces are their own runs rather than the first character of the next span:
 * a leading space inside the hidden node is thrown away and the name comes back
 * "96roles".
 *
 * Neither run costs anything on screen. A whitespace-only run between two flex
 * items is not rendered, and the noun is out of flow -- the count column
 * measures the same 21px either way.
 */
export function OptionCount({ count }: { count: number }) {
  return (
    <>
      {" "}
      <span className="option__count">{count}</span>{" "}
      <span className="visually-hidden">{count === 1 ? "role" : "roles"}</span>
    </>
  );
}
