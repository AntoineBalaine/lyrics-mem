/**
 * Chooses the height of the chord symbols of a chart, and keeps every bar
 * inside its own width.
 *
 * Because a phone has far more height than width, the chords are sized from
 * the height: one size for the whole chart, the largest at which the chart
 * still fits its box, which is one screen tall. Width never makes a chord
 * shorter. A bar whose chords are wider than the bar at that size is
 * instead squeezed horizontally, so that its chords keep their full height
 * and only become narrower.
 *
 * Because CSS cannot measure text, this is done in the browser. Text height
 * is proportional to font size, so measuring the chart once at the largest
 * size says how far it must shrink, and a pass or two more corrects what
 * the section headings, which do not shrink, leave over.
 */

/** The size a chord takes when the chart is short enough to allow it, in rem. */
export const MAX_CHORD_REM = 3.5;

/** Because a floor would bring the overflow back, this one only stops a size from reaching zero. */
export const MIN_CHORD_REM = 0.2;

/** A little air, in pixels, so that a bar's last chord never touches the barline. */
const BAR_PADDING_PX = 2;

/** How many times the size is corrected after measuring what it produced. */
const REFINEMENT_PASSES = 4;

/**
 * Sets `--chord-size` on `root` from the height of the chart's box, then
 * squeezes every bar that is too narrow for its chords.
 */
export function fitChords(root: HTMLElement): void {
  const measures = Array.from(root.querySelectorAll<HTMLElement>('.measure'));
  for (const measure of measures) unsqueeze(measure);

  let rems = MAX_CHORD_REM;
  root.style.setProperty('--chord-size', `${rems}rem`);
  for (let pass = 0; pass < REFINEMENT_PASSES; pass++) {
    const ratio = heightRatio(root);
    if (ratio >= 1) break;
    const next = Math.max(MIN_CHORD_REM, rems * ratio);
    if (next === rems) break;
    rems = next;
    root.style.setProperty('--chord-size', `${rems.toFixed(3)}rem`);
  }

  for (const measure of measures) squeezeToFit(measure);
}

/**
 * How much of the chart's content fits the height of its box, as a ratio.
 *
 * Because the box is at most one screen tall and hides what overflows it,
 * a chart too long for one screen is taller inside than out, and the box's
 * height over the content's height says how far it must shrink.
 */
export function heightRatio(root: HTMLElement): number {
  const grid = root.querySelector<HTMLElement>('.chord-grid');
  if (grid === null || grid.clientHeight === 0) return 1;
  return Math.min(1, grid.clientHeight / grid.scrollHeight);
}

/** Puts a bar back to its own width, before it is measured again. */
export function unsqueeze(measure: HTMLElement): void {
  measure.style.removeProperty('width');
  measure.style.removeProperty('transform');
}

/**
 * Narrows a bar's chords, without making them shorter, when they are wider
 * than the bar.
 *
 * The bar is laid out at the width its chords need and then scaled along
 * its width only, so that the chords keep their places relative to each
 * other and their full height.
 */
export function squeezeToFit(measure: HTMLElement): void {
  const available = measure.clientWidth;
  if (available === 0) return;
  const needed = neededWidth(measure);
  if (needed <= available) return;
  measure.style.width = `${needed}px`;
  measure.style.transform = `scaleX(${(available / needed).toFixed(4)})`;
}

/**
 * How wide a bar's chords are at the current size.
 *
 * Because the chords of a bar sit side by side, a bar needs the sum of its
 * chords' widths and the gaps between them, whatever beats they fall on.
 */
export function neededWidth(measure: HTMLElement): number {
  const chords = Array.from(measure.querySelectorAll<HTMLElement>('.chord'));
  if (chords.length === 0) return 0;
  const gap = parseFloat(getComputedStyle(measure).columnGap) || 0;
  let needed = BAR_PADDING_PX + gap * (chords.length - 1);
  for (const chord of chords) needed += naturalWidth(chord);
  return needed;
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
  // Because the chords' web font arrives after the first fit, and a font
  // change resizes no element, the observer would never see it. The chords
  // are therefore fitted again once every font has loaded.
  void document.fonts.ready.then(() => fitChords(root));
  return watch;
}
