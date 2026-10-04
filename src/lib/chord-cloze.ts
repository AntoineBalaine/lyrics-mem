/**
 * Progressive cloze for the chord grid.
 *
 * Each level hides more than the one before it, so that a chart can be
 * played repeatedly with less of it visible each time. A hidden chord is
 * drawn as dashes rather than removed, which keeps the bar showing that a
 * chord was there and keeps the grid's columns where they were.
 *
 * Each level takes away everything the level before it did and more, so
 * that a chart never shows again something an earlier level had hidden:
 *
 *   1 — show everything.
 *   2 — hide every chord's quality, keeping its root. A reader still has
 *       the harmonic motion in front of them and has to recall whether a
 *       chord was a major seventh, a dominant or a half-diminished, which
 *       is a smaller step than losing the chord entirely and is where most
 *       of a tune's character sits.
 *   3 — hide the chords of every second bar outright, and keep the
 *       qualities hidden in the bars that remain. Bars are numbered from
 *       one within each group of four consecutive bars, and a bar is
 *       hidden when its position in the group is even, which reads as
 *       "every other bar". A bar with several chords has all of them
 *       hidden together.
 *   4 — hide every bar of each group but the first, whose quality stays
 *       hidden as before.
 *   5 — hide every chord.
 *
 * The grouping is by bar rather than by chord, and it runs continuously
 * over the whole chart in the order the bars are laid out, which is the
 * order a reader's eye takes.
 */

export type ChordLevel = 1 | 2 | 3 | 4 | 5;

export const CHORD_LEVELS: readonly ChordLevel[] = [1, 2, 3, 4, 5] as const;

/**
 * How much of a bar's chords is hidden.
 *
 * Named rather than given as a pair of booleans, because the three states
 * are exclusive: a bar is shown, or has only its qualities taken away, or
 * is hidden outright.
 */
export type BarHiding = 'none' | 'quality' | 'all';

const GROUP_SIZE = 4;

export function barHiding(indexInChart: number, level: ChordLevel): BarHiding {
  if (level === 1) return 'none';
  if (level === 2) return 'quality';
  if (level === 5) return 'all';
  // A bar this level does not hide outright still has its quality hidden,
  // because the level before it took every quality away and a later level
  // must not hand one back.
  const positionInGroup = (indexInChart % GROUP_SIZE) + 1;
  if (level === 3) return positionInGroup % 2 === 0 ? 'all' : 'quality';
  return positionInGroup === 1 ? 'quality' : 'all';
}
