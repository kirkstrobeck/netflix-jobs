// The board stores locations as comma-joined strings with no spaces, e.g.
// "Los Angeles,California,United States of America".
export function formatLocation(value: string): string {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

// `locations` is NOT NULL with a '{}' default, so fall back to the scalar
// `location` column when the array is empty.
export function formatLocations(locations: string[], location: string): string[] {
  const source = locations.length > 0 ? locations : [location];
  const seen = new Set<string>();

  for (const entry of source) {
    const formatted = formatLocation(entry);

    if (formatted) {
      seen.add(formatted);
    }
  }

  return [...seen];
}
