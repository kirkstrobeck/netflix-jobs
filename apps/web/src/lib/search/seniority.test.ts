import { describe, expect, it } from "vitest";

import { seniorityLevels } from "@/lib/search/seniority";

// Almost every title quoted below is a real posting from the board this was
// measured against. A rule derived from titles is only as good as the titles it
// was derived from, so the cases that decided each rule are the cases pinned
// here.
//
// The exceptions are named where they appear and are all of one kind: a rung
// the board has no live example of. "VP" and "Chief <x> Officer" match nothing
// today, and a rule with no test is a rule that quietly stops working the first
// time it matters.

describe("the individual-contributor ladder", () => {
  it.each([
    ["Software Engineer 4 - Graph Search", "mid"],
    ["Software Engineer 5 - Ads Pricing & Packaging", "senior"],
    ["Distributed Systems Engineer 6 - Ad Eventing", "staff"],
    ["Software Engineer 3- Ink", "entry"],
  ])("reads the bare rung in %s as %s", (title, level) => {
    expect(seniorityLevels(title)).toEqual([level]);
  });

  it.each([
    ["Software Engineer (L6), Platform Security", "staff"],
    ["Machine Learning Scientist (L6) - Live Ads", "staff"],
    ["Distributed Systems Engineer (L4) - Data Platform", "mid"],
    ["Technical Program Manager (L6) - Ads Decisioning & Optimization", "staff"],
  ])("reads the parenthesised L form in %s as %s", (title, level) => {
    expect(seniorityLevels(title)).toEqual([level]);
  });

  it.each([
    ["Staff Product Designer, Developer Platform", "staff"],
    ["Principal Counsel, Litigation", "staff"],
    ["Member of Technical Staff, Agentic Systems - Games", "staff"],
    ["Senior Ads Revenue Business Partner (EMEA)", "senior"],
    ["Sr. Account Manager (Benelux)", "senior"],
    ["Associate, Games FP&A", "entry"],
    ["Coordinator, Training - Netflix Animation Studios", "entry"],
    ["Administrative Assistant, FinOps", "entry"],
    ["Video Algorithms Intern, Video Coding (Gaussian Splatting), Fall 2026", "entry"],
  ])("reads the word in %s as %s", (title, level) => {
    expect(seniorityLevels(title)).toEqual([level]);
  });

  // A title states its highest rung, so the top of the ladder is read first.
  // "Staff ML Software Engineer (L6)" holds no other word, but "Associate
  // Counsel" holds a senior profession and a junior rung, and the rung wins.
  it("takes the highest word a title states", () => {
    expect(
      seniorityLevels("Staff ML Software Engineer (L6) — Platform Systems"),
    ).toEqual(["staff"]);
    expect(
      seniorityLevels("Associate Counsel, Ads, Marcomms, and Consumer Products - Korea"),
    ).toEqual(["entry"]);
  });

  /**
   * Eleven of the 481 postings advertise two rungs at once. They are two
   * answers rather than a range to average: someone filtering for Mid level and
   * someone filtering for Senior should both be shown "Software Engineer 4/5",
   * because both could take it.
   */
  it.each([
    ["Software Engineer 4/5 – Model Development and Management, AI Platform", ["mid", "senior"]],
    ["Research Scientist 5/6 – AI for Member Systems", ["senior", "staff"]],
    ["Software Engineer L4/5, Javascript Foundations", ["mid", "senior"]],
    ["Software Engineer (4/5) — Developer Platform", ["mid", "senior"]],
  ])("reads both rungs of %s", (title, levels) => {
    expect(seniorityLevels(title)).toEqual(levels);
  });

  // The number is the more specific statement, so it outranks the word. This
  // posting is open at 4 AND 5; reading only "Senior" off it would hide it from
  // the filter that its own title says it is also open to.
  it("prefers the stated rung to the word beside it", () => {
    expect(seniorityLevels("Senior Software Engineer 4/5 - Client And Partner Technologies"))
      .toEqual(["mid", "senior"]);
  });
});

describe("the management track", () => {
  it.each([
    "Manager, Physical Security",
    "Senior Manager, Publicity",
    "Sr. Manager, Studio FP&A",
    "Sr Manager, Global Marketing - Content Localization",
    "Engineering Manager - Mobile Core",
    "Senior Engineering Manager - Agent Platform, AI Platform",
    "Head of Environments - Netflix Animation Studios",
    "Lighting Supervisor - Netflix Animation Studios",
  ])("reads %s as a manager", (title) => {
    expect(seniorityLevels(title)).toEqual(["manager"]);
  });

  it.each([
    "Director, Cloud Gaming Infrastructure",
    "Korea Finance Director - Strategy, Planning, and Studio Finance",
    // Not on the board today. Both are here so the top of the bucket is covered
    // before the first one is posted rather than after.
    "VP, Ads Revenue",
    "Chief Technology Officer",
  ])("reads %s as director and above", (title) => {
    expect(seniorityLevels(title)).toEqual(["director"]);
  });

  // The management track is a statement about the ROLE and outranks any rung in
  // the same string: a TPM 6 is an IC at level 6, and a Manager who is also a
  // 6 is still what the filter is asked for when Manager is ticked.
  // The first is the real "Manager, Data Science & Engineering - Title & Launch
  // Management" with a rung added, since no live posting spells both at once.
  it("outranks a rung stated in the same title", () => {
    expect(seniorityLevels("Manager, Data Science & Engineering 5 - Title Management"))
      .toEqual(["manager"]);
    expect(seniorityLevels("Director, Technical Program Management - Ads Foundations"))
      .toEqual(["director"]);
  });
});

/**
 * The false positives that shaped the rules. Each of these was in the wrong
 * bucket at some point, and each one is a filter quietly lying to somebody.
 */
describe("the words that are not levels", () => {
  // Eighteen titles hold "Director" and only eight are leadership. The rest are
  // the animation craft ladder, where it names a discipline.
  it.each([
    "Art Director - Ink",
    "Technical Director Lighting - Netflix Animation Studios",
    "Studio Creative Director",
    "Creative Director, Creative Publishing",
  ])("does not read the craft title %s as leadership", (title) => {
    expect(seniorityLevels(title)).not.toContain("director");
  });

  // 178 titles contain "Manager" and most of them are individual contributors.
  // "Product Manager" is the job, not the rung.
  it.each([
    "Product Manager, Personalization",
    "Technical Program Manager - Hawkins Design System",
    "Account Manager (Australia)",
    "Artist Manager - Netflix Animation Studios",
  ])("does not read the IC title %s as a manager", (title) => {
    expect(seniorityLevels(title)).not.toContain("manager");
  });

  // A contract length is not a rung. This one read as entry level while 1 and 2
  // were in the numeric class, which is why they are not.
  it("does not read a contract length as a level", () => {
    expect(seniorityLevels("Launch Manager (1-Year Fixed-Term Contract)")).toEqual([]);
    expect(
      seniorityLevels("Technology Experience Specialist - Studio (12 months FTC)"),
    ).toEqual([]);
  });

  // A req id is digits next to letters, and the board prints one in a title.
  it("does not read a requisition number as a level", () => {
    expect(seniorityLevels("JR41525 Technology Experience Specialist (12 months FTC)"))
      .toEqual([]);
  });
});

/**
 * The fall-through, which is the deliberate half of this.
 *
 * 139 of 481 live postings state no level. They are counted under no option and
 * matched by no selection, exactly as a job with a null `team` is -- an empty
 * list, not a bucket called "other". Inventing a rung for "Counsel,
 * Experiences" would put a filter's name on a guess.
 */
describe("the titles that state no level", () => {
  it.each([
    "Product Manager, Core Discovery",
    "Counsel, Experiences",
    "Storyboard Artist- Ink",
    "Treasury Analyst",
    "Compositor - Netflix Animation Studios",
    "Specialist, Performance Marketing",
  ])("gives %s no level at all", (title) => {
    expect(seniorityLevels(title)).toEqual([]);
  });

  it("gives an empty title no level", () => {
    expect(seniorityLevels("")).toEqual([]);
  });
});
