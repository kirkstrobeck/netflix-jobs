// A failing gate has to say which job, which property and which rule -- an exit
// code and a count send the next person back to the database to find out what
// broke. Each entry is one subject with its violations underneath it.
const RULE = "-".repeat(60);

export function section(title, failures) {
  const lines = [`${RULE}\n${title}\n${RULE}`];

  failures.forEach((failure) => {
    lines.push(`\n${failure.subject}`);
    failure.violations.forEach((violation) => lines.push(`  - ${violation}`));
  });

  return lines.join("\n");
}

export function summary(rows) {
  const width = Math.max(...rows.map((row) => row.label.length));

  return rows
    .map((row) => {
      const mark = row.failed === 0 ? "ok" : `FAIL (${row.failed})`;

      return `  ${row.label.padEnd(width)}  ${String(row.checked).padStart(4)} checked  ${mark}`;
    })
    .join("\n");
}
