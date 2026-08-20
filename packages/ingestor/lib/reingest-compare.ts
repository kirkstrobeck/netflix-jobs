import type { DbCounts } from './reingest-counts.ts';

export type Verdict = { agree: boolean; local: DbCounts; hosted: DbCounts };

export function compare(local: DbCounts, hosted: DbCounts): Verdict {
  const agree =
    local.activeRoles === hosted.activeRoles &&
    local.locationLinks === hosted.locationLinks &&
    local.rolesWithCoords === hosted.rolesWithCoords;
  return { agree, local, hosted };
}

function col(n: number): string {
  return String(n).padStart(6);
}

export function formatTable(local: DbCounts, hosted: DbCounts): string {
  const v = compare(local, hosted);
  const lines = [
    `  ${'Metric'.padEnd(20)} ${'Local'.padStart(6)}  ${'Hosted'.padStart(6)}`,
    `  ${'─'.repeat(36)}`,
    `  ${'Active roles'.padEnd(20)} ${col(local.activeRoles)}  ${col(hosted.activeRoles)}`,
    `  ${'Location links'.padEnd(20)} ${col(local.locationLinks)}  ${col(hosted.locationLinks)}`,
    `  ${'Roles with coords'.padEnd(20)} ${col(local.rolesWithCoords)}  ${col(hosted.rolesWithCoords)}`,
    '',
    v.agree ? 'AGREE' : 'DISAGREE',
  ];
  return lines.join('\n');
}
