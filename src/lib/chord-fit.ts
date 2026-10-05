/**
 * Sizes each chord symbol to the width its cell actually has.
 *
 * Because CSS cannot measure text, the renderer only passes a first guess
 * for the size, worked out from a count of characters. That guess cannot
 * know the real width of a glyph, the width a barline takes or the gap
 * between bars, so on a phone it left chords spilling out of their cells.
 * Since the browser knows the true widths, we measure here instead: text
 * width is proportional to font size, so measuring a chord once at the
 * largest size tells us exactly what size makes it fit.
 */

/** The size a chord takes when it has room to spare, in rem. */
export const MAX_CHORD_REM = 1.3;

/** Because a floor would bring the overflow back, this one only stops a size from reaching zero. */
export const MIN_CHORD_REM = 0.3;

/** A little air, in pixels, so that a chord never touches the next cell. */
const CELL_PADDING_PX = 1;

/** How many times a size is corrected after measuring what it produced. */
const REFINEMENT_PASSES = 3;

export interface Measured {
  bar: HTMLElement;
  cell: HTMLElement;
  chord: HTMLElement;
  available: number;
  natural: number;
  rems: number;
}

/**
 * Sets `--fit` on every cell under `root` so that its chord fits the cell.
 *
 * Because reading a width right after writing a style forces the browser to
 * lay the page out again, the writes and the reads are kept in separate
 * passes: one write to give every chord its largest size, one read of all of
 * them, then a write of the sizes that fit and a read to check them.
 */
export function fitChords(root: HTMLElement): void {
  const cells = Array.from(root.querySelectorAll<HTMLElement>('.measure > .cell'));
  for (const cell of cells) cell.style.setProperty('--fit', `${MAX_CHORD_REM}rem`);

  const measured: Measured[] = [];
  for (const cell of cells) {
    const chord = cell.querySelector<HTMLElement>('.chord');
    // A hidden view has no width at all, and sizing against that would
    // shrink every chord to the floor. The observer fits it once it shows.
    if (!chord || cell.clientWidth === 0) continue;
    measured.push({
      bar: cell.parentElement ?? cell,
      cell,
      chord,
      available: cell.clientWidth - CELL_PADDING_PX,
      natural: naturalWidth(chord),
      rems: MAX_CHORD_REM,
    });
  }

  // Because text does not scale perfectly with its size, the first estimate
  // can still be a pixel or two too wide. Measuring again after each write
  // and shrinking by what is left over converges within a pass or two.
  let pending = measured;
  for (let pass = 0; pass < REFINEMENT_PASSES && pending.length > 0; pass++) {
    for (const item of pending) {
      item.rems = Math.min(MAX_CHORD_REM, Math.max(MIN_CHORD_REM, (item.rems * item.available) / item.natural));
      item.cell.style.setProperty('--fit', `${item.rems.toFixed(3)}rem`);
    }
    for (const item of pending) item.natural = naturalWidth(item.chord);
    pending = pending.filter((item) => item.natural > item.available && item.rems > MIN_CHORD_REM);
  }

  shareSizeWithinBars(measured);
}

/**
 * Gives every chord of a bar the one size that the tightest of them needs.
 *
 * Because each chord was fitted to its own cell, a bar holding four chords
 * showed them at four sizes, the later ones smaller as the room ran out.
 * The size is a property of the bar, so the smallest size any chord in it
 * needs is the size they all take. A chord that would have fitted larger
 * then fits with room to spare, which costs nothing and reads as one bar.
 */
export function shareSizeWithinBars(measured: Measured[]): void {
  const smallest = new Map<HTMLElement, number>();
  for (const { bar, rems } of measured) {
    smallest.set(bar, Math.min(rems, smallest.get(bar) ?? MAX_CHORD_REM));
  }
  for (const { bar, cell } of measured) {
    cell.style.setProperty('--fit', `${(smallest.get(bar) ?? MAX_CHORD_REM).toFixed(3)}rem`);
  }
}

/**
 * The width of a chord's text, which is not the width of its element:
 * the element is a block that fills the cell, so it would always report
 * the cell's own width.
 */
export function naturalWidth(chord: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(chord);
  return range.getBoundingClientRect().width;
}

/** The state the observer needs between its calls, kept out of a closure. */
export interface FitWatch {
  root: HTMLElement;
  lastWidth: number;
}

/**
 * Fits the chords again, but only when the chart's width has changed.
 *
 * Because our own writes can change the height of the chart, and fitting
 * again on that would loop, a change of height alone is ignored.
 */
export function refitOnWidthChange(watch: FitWatch): void {
  if (watch.root.clientWidth === watch.lastWidth) return;
  watch.lastWidth = watch.root.clientWidth;
  fitChords(watch.root);
}

/**
 * Keeps the chords of a chart fitted for as long as the chart is on screen.
 *
 * Because the width of a cell changes with rotation, with a resize and with
 * the chart view becoming visible after being hidden, a single fit at render
 * time would be wrong as soon as any of those happened. An observer on the
 * chart covers all three.
 */
export function keepChordsFitted(root: HTMLElement): FitWatch {
  const watch: FitWatch = { root, lastWidth: -1 };
  new ResizeObserver(() => refitOnWidthChange(watch)).observe(root);
  return watch;
}
