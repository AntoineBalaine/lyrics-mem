/**
 * Progressive cloze for chord symbols in ABC-notation chord charts.
 *
 * The ABC text produced by AbcLs's ABCx→ABC converter places each chord
 * symbol as a quoted annotation immediately before the invisible-rest run
 * that fills its bar (e.g. `"Cmaj7"x4 "F7"x4 | "Bbmaj7"x8 |`). Hiding a
 * chord at a given level replaces every letter of its name with a
 * dash, keeping the quoted annotation itself in place (e.g.
 * `"Cmaj7"` becomes `"------"`), the same letter-blanking idea the
 * lyrics app uses (see transformations.ts's step3FirstLetters), rather
 * than deleting the annotation outright — dropping it entirely left that
 * bar with no annotation text at all, which made abcjs lay it out
 * visibly narrower than its neighbors.
 *
 * Levels:
 *   1 — show every chord symbol.
 *   2 — hide half the chords, per 4-bar group. Chords are numbered
 *       1-based within each group of 4 consecutive bars (bars, not chord
 *       count, define the grouping); a chord is hidden when its 1-based
 *       *bar index within the group* is even (i.e. bars 2 and 4 of each
 *       group have all their chords hidden, bars 1 and 3 keep theirs).
 *       This is a simple, deterministic rule that reads as "every other
 *       bar" and degrades sensibly for bars with more than one chord
 *       (all chords in a hidden bar are hidden together) or fewer bars
 *       than 4 in the final group (the rule still applies positionally).
 *   3 — show only the first chord of every 4-bar group (i.e. only chords
 *       in the first bar of each group survive), hide everything else.
 *   4 — hide every chord symbol.
 */

export type ChordLevel = 1 | 2 | 3 | 4;

export const CHORD_LEVELS: readonly ChordLevel[] = [1, 2, 3, 4] as const;

const GROUP_SIZE = 4;

// Matches a quoted ABC annotation/chord-symbol, e.g. "Cmaj7" or "F#7b9".
const CHORD_ANNOTATION_RE = /"([^"]*)"/g;

/**
 * Splits an ABC tune body into segments alternating between bar content
 * and the `|` bar-separator tokens (including compound separators like
 * `||`, `|:`, `:|`, `[|`). This is a lightweight lexical split, not a
 * full ABC parser: it is only used to find bar boundaries so we know
 * which annotations belong to which bar.
 */
function splitIntoBars(body: string): string[] {
  // Split on runs of bar-line characters, keeping the separators so the
  // text can be reassembled exactly (including whitespace) once chords
  // have been selectively stripped.
  return body.split(/(\|+:?|:\|+|\[\|)/);
}

function shouldHideBar(barIndexZeroBased: number, level: ChordLevel): boolean {
  const posInGroup = (barIndexZeroBased % GROUP_SIZE) + 1; // 1-based, 1..4
  switch (level) {
    case 1:
      return false;
    case 2:
      return posInGroup % 2 === 0; // hide bars 2 and 4 of each group
    case 3:
      return posInGroup !== 1; // keep only bar 1 of each group
    case 4:
      return true;
  }
}

// Hiding a chord replaces each letter of its name with a dash,
// keeping the annotation itself (same quoted-string length) rather than
// deleting it outright — mirroring the lyrics app's own letter-blanking
// steps (see transformations.ts's step3FirstLetters). Deleting the
// annotation entirely used to leave the bar with no annotation text at
// all, which made abcjs lay that measure out visually narrower/shorter
// than its neighbors that still carry a chord annotation; keeping a
// same-length placeholder string preserves the measure's normal width.
function stripChordsFromBarText(barText: string): string {
  return barText.replace(CHORD_ANNOTATION_RE, (_match, name: string) => `"${'-'.repeat(name.length)}"`);
}

/**
 * Applies a cloze level to one line of ABC tune-body text. Header lines
 * (`X:`, `T:`, `C:`, `K:`, etc.) and comment lines (`%...`) are passed
 * through untouched — only lines that look like tune-body content
 * (containing a bar separator or a quoted chord) are processed.
 */
function applyLevelToLine(line: string, level: ChordLevel, barCounter: { n: number }): string {
  const isHeaderLine = /^[A-Za-z]:/.test(line) || /^%/.test(line);
  if (isHeaderLine) return line;
  if (level === 1) return line;

  const segments = splitIntoBars(line);
  let result = '';
  for (const seg of segments) {
    if (/^(\|+:?|:\|+|\[\|)$/.test(seg)) {
      // Separator token — passes through, then a new bar begins after it.
      result += seg;
      continue;
    }
    if (seg.trim() === '') {
      result += seg;
      continue;
    }
    const hide = shouldHideBar(barCounter.n, level);
    result += hide ? stripChordsFromBarText(seg) : seg;
    barCounter.n += 1;
  }
  return result;
}

/**
 * Returns the ABC source text for a given cloze level, with chord
 * annotations selectively stripped per the rules above. Bar numbering
 * for the 4-bar grouping runs continuously across the whole tune body
 * (across newlines), matching how a musician reads the chart start to
 * finish.
 */
export function applyChordLevel(level: ChordLevel, abc: string): string {
  if (level === 1) return abc;
  const barCounter = { n: 0 };
  return abc
    .split('\n')
    .map((line) => applyLevelToLine(line, level, barCounter))
    .join('\n');
}
