/** The chips after `typed` is added: trimmed, and ignored when blank or already there. */
export function withChip(chips: readonly string[], typed: string): string[] {
  const value = typed.trim();
  if (value === "" || chips.includes(value)) {
    return [...chips];
  }
  return [...chips, value];
}

/** Words the workspace already uses that contain `typed`, ignoring case, minus the chosen ones. */
export function candidatesFor(
  vocabulary: readonly string[],
  typed: string,
  chosen: readonly string[],
): string[] {
  const wanted = typed.trim().toLowerCase();
  if (wanted === "") {
    return [];
  }
  return vocabulary.filter((word) => word.toLowerCase().includes(wanted) && !chosen.includes(word));
}
