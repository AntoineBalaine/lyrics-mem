/**
 * Extracts just the bar/chord grid from an ABC-notation chord chart,
 * dropping header fields (X:, T:, C:, K:, ...) and comment lines (%...),
 * and unwrapping each chord from its ABC annotation syntax (quoted,
 * followed by an invisible-rest run sized to fill its bar — lowercase
 * `x4`-style for a partial bar, or a bare uppercase `X` (no count) for a
 * chord that fills the whole bar, e.g. `"Cm7"x4` or `"Am"X`) back down to
 * plain chord text (`Cm7`, `Am`).
 *
 * Used for the "copy to clipboard" action: a musician pasting a chart
 * elsewhere (or into a chat, to point out a chord that looks wrong) wants
 * the chord grid itself — the same shape as iReal Pro's own chord-chart
 * text — not the ABC header noise or rest-filler notation that only
 * exists to make abcjs lay the score out correctly.
 *
 * Mirrors the header-line test chord-cloze.ts's applyLevelToLine uses to
 * skip header lines when rewriting chord annotations, and the quoted-
 * annotation pattern chord-cloze.ts's CHORD_ANNOTATION_RE matches.
 */
function isHeaderLine(line: string): boolean {
  return /^[A-Za-z]:/.test(line) || /^%/.test(line);
}

// Matches a quoted chord annotation plus the invisible-rest run
// immediately following it, e.g. `"Cm7"x4`, `"----"x8`, or a whole-bar
// `"Am"X` (uppercase, no count).
const ANNOTATED_CHORD_RE = /"([^"]*)"[xX]?\d*/g;

export function extractChordChartBody(abc: string): string {
  return abc
    .split('\n')
    .filter((line) => !isHeaderLine(line))
    .join('\n')
    .replace(ANNOTATED_CHORD_RE, '$1')
    .trim();
}
