// The structured-data gate: every active posting's JSON-LD, the Organization
// node, the breadcrumbs and llms.txt, checked against the specs rather than
// against a snapshot of yesterday's output.
//
// It runs the SAME builders the pages import -- apps/web/tools/ts-alias.mjs
// teaches plain node the "@/" alias, so there is no second copy of the markup
// here to drift from the first. What this file adds is the corpus: all 481 rows
// of real crawled data, where a location string with a country nobody mapped or
// a posting with no date shows up as a failure with the job code attached.
import { readFileSync } from "node:fs";

import { activeJobs } from "./jobs.mjs";
import { checkLogo } from "./logo.mjs";
import { section, summary } from "./report.mjs";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const WEB = `${REPO_ROOT}apps/web`;

await import(`${WEB}/tools/ts-alias.mjs`);

const { validateLlmsTxt } = await import("@/lib/llms/validate-llms-txt");
const { buildBreadcrumbs } = await import("@/lib/seo/breadcrumbs");
const { buildJobPosting } = await import("@/lib/seo/job-posting");
const { netflixOrganization } = await import("@/lib/seo/organization");
const { checkBreadcrumbList } = await import("@/lib/seo/rules/breadcrumb-rules");
const { checkJobPosting } = await import("@/lib/seo/rules/job-posting-rules");
const { checkOrganization } = await import("@/lib/seo/rules/organization-rules");
const { parseJobLocation } = await import("@/lib/seo/job-location");

function checkLlms() {
  const path = `${WEB}/public/llms.txt`;
  const violations = validateLlmsTxt(readFileSync(path, "utf8"));

  return { checked: 1, failures: violations.length === 0 ? [] : [{ subject: path, violations }] };
}

function checkOrg() {
  const violations = [
    ...checkOrganization(netflixOrganization()),
    ...checkLogo(`${WEB}/src/app/icon1.png`).violations,
  ];

  return {
    checked: 1,
    failures: violations.length === 0 ? [] : [{ subject: "Organization (listing page)", violations }],
  };
}

function subjectOf(job) {
  return `${job.display_job_id ?? job.position_id}  ${job.title}`;
}

// A location string the parser cannot place is dropped from jobLocation rather
// than guessed at, which is right for the page and invisible from the finished
// markup: the posting still has its other two locations and validates. So the
// strings are checked here, against the row, where a country the crawl has never
// produced before names itself.
function checkLocations(job) {
  const listed = job.locations.length > 0 ? job.locations : [job.location];

  return listed
    .filter((value) => value && parseJobLocation(value) === null)
    .map((value) => `location ${JSON.stringify(value)} could not be parsed -- unknown country?`);
}

function checkOneJob(job) {
  const posting = buildJobPosting(job);

  // Null means a required property could not be filled from the crawl, so the
  // page emits nothing. That is the right runtime behaviour and the wrong state
  // for the board to be in, which is exactly what a gate is for.
  if (!posting) {
    return ["no JobPosting could be built: a required property is missing from the row"];
  }

  return [
    ...checkJobPosting(posting),
    ...checkBreadcrumbList(buildBreadcrumbs(job)),
    ...checkLocations(job),
  ];
}

function checkJobs(jobs) {
  const failures = jobs
    .map((job) => ({ subject: subjectOf(job), violations: checkOneJob(job) }))
    .filter((entry) => entry.violations.length > 0);

  return { checked: jobs.length, failures };
}

// Proof, printed on success as well as failure: the real JSON-LD for one real
// posting, so "the gate passed" is something anyone can read rather than take on
// trust. Pinned by SD_SAMPLE_JOB when a specific posting is in question.
function printSample(jobs) {
  const wanted = process.env.SD_SAMPLE_JOB;
  const job = jobs.find((entry) => entry.display_job_id === wanted) ?? jobs[0];

  console.log(`\nemitted JSON-LD for ${subjectOf(job)}:`);
  console.log(JSON.stringify(buildJobPosting(job), null, 2));
}

async function main() {
  const jobs = await activeJobs();
  const results = [
    { label: "llms.txt", ...checkLlms() },
    { label: "Organization", ...checkOrg() },
    { label: "JobPosting + BreadcrumbList", ...checkJobs(jobs) },
  ];

  console.log("\nstructured data, validated against the published specs");
  console.log(summary(results.map((r) => ({ ...r, failed: r.failures.length }))));

  const failed = results.filter((result) => result.failures.length > 0);

  if (failed.length === 0) {
    printSample(jobs);
    console.log("\nall clear");
    return;
  }

  failed.forEach((result) => console.log(`\n${section(result.label, result.failures)}`));
  process.exitCode = 1;
}

await main();
