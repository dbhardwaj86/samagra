// Terminal command-line parser — pure, headless-testable.
// Mirrors prototype runCmd tokenization (proto.md §4.1).

export interface ParsedCommand {
  /** The raw input, untouched. */
  raw: string;
  /** First token, lowercased. Empty string for empty input. */
  c0: string;
  /** Remaining tokens (case preserved). */
  args: string[];
  /** args joined by a single space (rest of line, whitespace-collapsed). */
  arg: string;
  /** `clear` is special-cased first in the prototype. */
  clear: boolean;
  /** Whitespace-only / empty input runs no command. */
  empty: boolean;
}

/**
 * Tokenize a terminal input line.
 *
 * - Trims, then splits on `/\s+/` so runs of whitespace collapse.
 * - `c0` is the first token lowercased; `args` are the rest (case preserved);
 *   `arg` is `args.join(' ')`.
 * - Empty / whitespace-only input is flagged via `empty` (no command runs).
 * - `clear` is flagged via `clear` (special-cased before dispatch).
 */
export function parse(input: string): ParsedCommand {
  const raw = input ?? "";
  const trimmed = raw.trim();

  if (trimmed === "") {
    return { raw, c0: "", args: [], arg: "", clear: false, empty: true };
  }

  const parts = trimmed.split(/\s+/);
  const c0 = parts[0].toLowerCase();
  const args = parts.slice(1);
  const arg = args.join(" ");

  return { raw, c0, args, arg, clear: c0 === "clear", empty: false };
}
