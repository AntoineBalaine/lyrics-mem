/**
 * Draws a laid-out iReal Pro chart as a text grid, either as HTML for the
 * page or as plain text for the clipboard.
 *
 * Both outputs come from one traversal so that what is on screen and what
 * is copied can never disagree about what the chart says. All three
 * notation modes share that traversal too, differing only in what a single
 * cell prints: the chord symbol view and the two number views used to be
 * separate code paths because one of them went through staff engraving, and
 * they drifted apart every time either was touched.
 *
 * Nothing here parses anything. A chord arrives as a ParsedChord and a
 * barline as an IrealBarline, both from the layout in the parser package,
 * and the glyph tables below are keyed off those values rather than off text
 * that would have to be matched. That is the rule the whole rewrite rests
 * on: every defect it exists to remove came from a stage that was handed a
 * string and had to recover structure from it.
 */
import type { ChartLayout, IrealBarline, LaidOutBar, LaidOutCell } from 'abcls-parser';
import { ChordQuality, type ParsedChord } from 'abcls-parser';
import { KeyAccidental, type KeyRoot, type KeySignature } from 'abcls-parser/types/abcjs-ast';
import { formatDegree, nashvilleDegree, regularDegree } from 'abcls-parser/music-theory/numberNotation';
import { barHiding, type BarHiding, type ChordLevel } from './chord-cloze';
import type { NotationMode } from './chord-numbers';

export interface RenderOptions {
  mode: NotationMode;
  key: KeySignature;
  level: ChordLevel;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// How a barline prints. The layout decides which one stands where, and in
// particular gives the combined close-and-open its own value, so that this
// never has to decide whether two adjacent barlines should have been one.
const BARLINE_TEXT: Record<IrealBarline, string> = {
  plain: '|',
  openRepeat: '|:',
  closeRepeat: ':|',
  closeOpenRepeat: ':|:',
  final: '||',
};

const ACCIDENTAL_TEXT: Record<KeyAccidental, string> = {
  [KeyAccidental.None]: '',
  [KeyAccidental.Sharp]: '#',
  [KeyAccidental.Flat]: 'b',
};

// Display glyphs for the accidental in a chord root or a degree. The plain
// ASCII spelling is what the clipboard gets, since a chart pasted elsewhere
// is read by tools that expect iReal Pro's own convention.
const ACCIDENTAL_GLYPH: Record<KeyAccidental, string> = {
  [KeyAccidental.None]: '',
  [KeyAccidental.Sharp]: '♯',
  [KeyAccidental.Flat]: '♭',
};

/**
 * The quality part of a chord's name, in iReal Pro's own ASCII spelling.
 *
 * Keyed off the quality and the extension as values. Deriving it by
 * rewriting a chord's text with patterns is what the previous
 * implementation did, and a pattern for "maj7" cannot tell a quality from a
 * chord root that happens to contain those letters.
 */
function qualityText(chord: ParsedChord): string {
  const extension = chord.extension === null ? '' : String(chord.extension);
  if (!chord.qualityExplicit || chord.quality === ChordQuality.Dominant) return extension;
  switch (chord.quality) {
    case ChordQuality.Major:
      return 'maj' + extension;
    case ChordQuality.Minor:
      return 'm' + extension;
    case ChordQuality.Diminished:
      return 'dim' + extension;
    case ChordQuality.Augmented:
      // iReal Pro's "C7+" and "C+7" are a dominant seventh with a raised
      // fifth. Writing that as "Caug7" reads at least as plausibly as an
      // augmented major seventh once it is pasted elsewhere, and the same
      // chart writes the unambiguous spelling for the same sound where it
      // happens to use "#5" instead, so the unambiguous one is used for
      // both.
      return extension === '' ? 'aug' : extension + '#5';
    case ChordQuality.HalfDiminished:
      return 'm7b5';
    case ChordQuality.Suspended2:
      return extension === '' ? 'sus2' : extension + 'sus2';
    case ChordQuality.Suspended4:
      return extension === '' ? 'sus4' : extension + 'sus';
    case ChordQuality.Power:
      return '5';
    case ChordQuality.Add:
      return 'add' + extension;
    case ChordQuality.Altered:
      return extension + 'alt';
    case ChordQuality.MinorMajor7:
      return 'mMaj' + extension;
    case ChordQuality.DiminishedMajor7:
      return 'dimMaj' + extension;
  }
}

/**
 * The same quality as a musician writes it by hand.
 *
 * A major seventh is a bare triangle and a half-diminished a bare slashed
 * circle, in both cases because the glyph already carries the seventh, and
 * a fully diminished seventh is the degree sign. The seventh is dropped
 * only where the glyph implies it; a major ninth keeps its nine.
 */
function isHalfDiminished(chord: ParsedChord): boolean {
  if (chord.quality === ChordQuality.HalfDiminished) return true;
  // A chart may write the same chord as a minor seventh with a flattened
  // fifth, which the parser classifies as Minor with a b5 alteration. The
  // library uses both spellings in quantity, so without this a single
  // chart shows one chord in two notations.
  return (
    chord.quality === ChordQuality.Minor &&
    chord.extension === 7 &&
    chord.alterations.length === 1 &&
    chord.alterations[0].type === 'flat' &&
    chord.alterations[0].degree === 5
  );
}

function qualityGlyphs(chord: ParsedChord): string {
  const extension = chord.extension === null ? '' : String(chord.extension);
  if (!chord.qualityExplicit || chord.quality === ChordQuality.Dominant) return extension;
  if (isHalfDiminished(chord)) return 'ø';
  switch (chord.quality) {
    case ChordQuality.Major:
      return '△' + (extension === '7' ? '' : extension);
    case ChordQuality.HalfDiminished:
      return 'ø';
    case ChordQuality.Diminished:
      // The degree sign alone is the diminished triad. A diminished
      // seventh keeps its seven, because the two are different chords and
      // the library writes both: 161 bare "o" chords beside the sevenths.
      return '°' + extension;
    case ChordQuality.MinorMajor7:
      return 'm△' + (extension === '7' ? '' : extension);
    case ChordQuality.DiminishedMajor7:
      return '°△' + (extension === '7' ? '' : extension);
    default:
      return qualityText(chord);
  }
}

/**
 * The colour family a chord belongs to, as a class name, or null for one
 * that gets no colour of its own.
 *
 * Only the four families named by the request are coloured, so an
 * augmented, suspended, power or added chord stays in the body text's own
 * colour rather than being given a meaning by implication.
 *
 * Two readings need care. A bare `C` parses as a dominant with no
 * extension, because the dialect writes a dominant as the absence of a
 * quality symbol, and musically it is a major triad, so it is coloured as
 * one: red is for a dominant that actually names a seventh or above. And
 * the half-diminished test is the same predicate the glyph uses, so that
 * `Ch7` and `C-7b5`, which the parser reads as two different qualities,
 * come out the same colour as well as the same symbol.
 */
function qualityClass(chord: ParsedChord): string | null {
  if (isHalfDiminished(chord)) return 'quality-half-diminished';
  switch (chord.quality) {
    case ChordQuality.Dominant:
      return chord.extension === null ? 'quality-major' : 'quality-dominant';
    case ChordQuality.Minor:
      return 'quality-minor';
    case ChordQuality.Major:
      return 'quality-major';
    default:
      return null;
  }
}

function alterationsText(chord: ParsedChord, glyphs: boolean): string {
  // A half-diminished glyph already carries the flattened fifth, so
  // printing the alteration again would read as a doubly flattened fifth.
  const skipFlatFive = glyphs && isHalfDiminished(chord);
  return chord.alterations
    .filter((alt) => !(skipFlatFive && alt.type === 'flat' && alt.degree === 5))
    .map((alt) => (alt.type === 'sharp' ? '#' : 'b') + String(alt.degree))
    .join('');
}

/**
 * A note name, as a letter and accidental or as a scale degree.
 *
 * A chord's root and the bass note under it are spelled by the same rule,
 * which is why this takes the two values rather than a whole chord: the
 * quality and the extension have no bearing on how a note is named.
 */
function noteText(root: KeyRoot, accidental: KeyAccidental, opts: RenderOptions, glyphs: boolean): string {
  if (opts.mode === 'symbols') {
    const table = glyphs ? ACCIDENTAL_GLYPH : ACCIDENTAL_TEXT;
    return root + table[accidental];
  }
  const spelling =
    opts.mode === 'nashville'
      ? nashvilleDegree(root, accidental, opts.key)
      : regularDegree(root, accidental, opts.key);
  const plain = formatDegree(spelling);
  if (!glyphs) return plain;
  return plain.replace(/^#/, '♯').replace(/^b/, '♭');
}

function rootText(chord: ParsedChord, opts: RenderOptions, glyphs: boolean): string {
  return noteText(chord.root, chord.rootAccidental, opts, glyphs);
}

function bassText(chord: ParsedChord, opts: RenderOptions, glyphs: boolean): string {
  if (!chord.bass) return '';
  return '/' + noteText(chord.bass.root, chord.bass.accidental, opts, glyphs);
}

/** A chord as the two parts a number chart sets at different sizes. */
interface ChordParts {
  root: string;
  quality: string;
  bass: string;
}

function chordParts(chord: ParsedChord, opts: RenderOptions, glyphs: boolean): ChordParts {
  return {
    root: rootText(chord, opts, glyphs),
    quality: (glyphs ? qualityGlyphs(chord) : qualityText(chord)) + alterationsText(chord, glyphs),
    bass: bassText(chord, opts, glyphs),
  };
}

/**
 * What a cell with no chord of its own says.
 *
 * A back reference the parser could resolve has already become an ordinary
 * chord cell, so the kinds left here are the ones a chart genuinely states:
 * no chord at all, or a back reference with nothing before it to refer to,
 * which still names its bass note.
 */
function cellWithoutChordText(cell: LaidOutCell, opts: RenderOptions, glyphs: boolean): string {
  if (cell.kind === 'noChord') return 'N.C.';
  if (cell.bass) return '/' + noteText(cell.bass.root, cell.bass.accidental, opts, glyphs);
  return '';
}

/**
 * The navigation signs a line carries, if any.
 *
 * A chart's segno and coda are recorded as section indexes rather than as
 * marks on a bar, which is why they are looked up per line from the
 * section the line belongs to. Leaving them unrendered made a coda read as
 * an ordinary section, so a reader played straight into it instead of
 * jumping to it: 162 charts in the library carry at least one of the
 * three.
 */
function lineNavigationSigns(layout: ChartLayout, sectionIndex: number, isFirstLineOfSection: boolean): string[] {
  if (!isFirstLineOfSection) return [];
  const signs: string[] = [];
  const nav = layout.navigation;
  if (nav.segnoSectionIndex === sectionIndex) signs.push('S');
  if (nav.codaSectionIndex === sectionIndex) signs.push('Coda');
  // A part marker names a place the chart's own text refers back to, and
  // iReal Pro gives it no name beyond its position, so it is drawn as
  // itself rather than given a meaning it does not have.
  if (nav.partMarkerSections.includes(sectionIndex)) signs.push('U');
  return signs;
}

/**
 * The bars at which an ending's number is printed.
 *
 * An ending's number heads the ending rather than labelling each of its
 * bars, the way a volta bracket is drawn over the span it covers, so it is
 * printed only where a run of bars carrying one number begins.
 */
function endingNumberStarts(layout: ChartLayout): Set<number> {
  const starts = new Set<number>();
  let previous: number | undefined;
  for (const line of layout.lines) {
    for (const bar of line.bars) {
      if (bar.endingNumber !== undefined && bar.endingNumber !== previous) starts.add(bar.indexInChart);
      previous = bar.endingNumber;
    }
  }
  return starts;
}

/**
 * A hidden chord becomes dashes rather than disappearing, so that the bar
 * still shows a chord was there.
 *
 * The width comes from the chord's ASCII spelling in both outputs, rather
 * than from whichever spelling the output uses, because the two would
 * otherwise print different numbers of dashes for the same chord and a
 * reader comparing the page against the clipboard would see two charts.
 */
function dashes(width: number): string {
  return '-'.repeat(Math.max(1, width));
}

/**
 * A chord hidden, as dashes standing in for what would have been printed.
 *
 * The width is taken from the spelling the output doing the printing would
 * itself have used, which is why it depends on `glyphs`: a major seventh
 * shows as a single triangle on screen and as "maj7" in the clipboard, so
 * one dash stands in for it on screen and four in the clipboard. Taking
 * both widths from the ASCII spelling instead printed four dashes where
 * the chart had shown one glyph, which reads as a longer chord than the
 * one being hidden.
 */
function hiddenText(
  chord: ParsedChord | null,
  opts: RenderOptions,
  glyphs: boolean,
  fallbackWidth: number,
): string {
  if (!chord) return dashes(fallbackWidth);
  const parts = chordParts(chord, opts, glyphs);
  return dashes((parts.root + parts.quality + parts.bass).length);
}

/**
 * The width of the quality a chord's own root keeps in place of.
 *
 * Zero for a chord with no quality to speak of, a bare major triad among
 * them, which is then left as it is rather than given a dash standing for
 * nothing.
 */
function qualityHiddenWidth(chord: ParsedChord, opts: RenderOptions, glyphs: boolean): number {
  return chordParts(chord, opts, glyphs).quality.length;
}

function chordTextAt(chord: ParsedChord, opts: RenderOptions, glyphs: boolean, hiding: BarHiding): string {
  if (hiding === 'all') return hiddenText(chord, opts, glyphs, 0);
  const parts = chordParts(chord, opts, glyphs);
  if (hiding === 'quality') {
    const width = qualityHiddenWidth(chord, opts, glyphs);
    return parts.root + (width === 0 ? '' : dashes(width)) + parts.bass;
  }
  return parts.root + parts.quality + parts.bass;
}

function cellText(cell: LaidOutCell, opts: RenderOptions, glyphs: boolean, hiding: BarHiding): string {
  // An alternative chord is read even on a cell that names no chord of its
  // own, which four cells in the library do, so it is rendered from the
  // cell rather than from inside the chord branch.
  const alternative = cell.alternative
    ? ` (${chordTextAt(cell.alternative, opts, glyphs, hiding)})`
    : '';
  if (!cell.chord) {
    // A cell naming no chord has no quality to take away, so only the
    // level that hides everything touches it.
    const own = cellWithoutChordText(cell, opts, glyphs);
    const shown = hiding === 'all' && own !== '' ? hiddenText(null, opts, glyphs, own.length) : own;
    return shown + alternative;
  }
  return chordTextAt(cell.chord, opts, glyphs, hiding) + alternative;
}

function barText(bar: LaidOutBar, opts: RenderOptions, glyphs: boolean): string {
  const hiding = barHiding(bar.indexInChart, opts.level);
  const cells = bar.cells.map((cell) => cellText(cell, opts, glyphs, hiding)).filter((text) => text !== '');
  return cells.join(' ');
}

/**
 * The chart as plain text in iReal Pro's own ASCII convention, for the
 * clipboard. A chart pasted into another tool, or back into a message to
 * compare against, has to read the way iReal Pro writes it.
 */
export function renderGridText(layout: ChartLayout, opts: RenderOptions): string {
  const endingStarts = endingNumberStarts(layout);
  const lines: string[] = [];
  // A chart-level annotation attaches to no bar, so it heads the chart.
  for (const annotation of layout.annotations) lines.push(`<${annotation.text}>`);
  let previousSection = -1;
  for (const line of layout.lines) {
    const parts: string[] = [];
    const firstOfSection = line.sectionIndex !== previousSection;
    previousSection = line.sectionIndex;
    for (const sign of lineNavigationSigns(layout, line.sectionIndex, firstOfSection)) {
      parts.push(`[${sign}]`);
    }
    if (line.sectionLabel !== undefined) parts.push(`[${line.sectionLabel}]`);
    if (line.timeSignature !== undefined) {
      parts.push(`(${line.timeSignature.numerator}/${line.timeSignature.denominator})`);
    }
    for (const bar of line.bars) {
      parts.push(BARLINE_TEXT[bar.openBarline]);
      if (bar.endingNumber !== undefined && endingStarts.has(bar.indexInChart)) {
        parts.push(`${bar.endingNumber}.`);
      }
      parts.push(barText(bar, opts, false));
      // An annotation and a fermata are part of what the chart says, so the
      // clipboard carries them too. Showing them on screen and dropping
      // them from the copy is the one disagreement between the two outputs
      // this renderer exists to make impossible, and it would have cost a
      // reader every "D.C. al Coda" and "Fine" in the library.
      for (const annotation of bar.annotations) parts.push(`<${annotation.text}>`);
      if (bar.fermata) parts.push('(fermata)');
    }
    parts.push(BARLINE_TEXT[line.closeBarline]);
    lines.push(parts.filter((part) => part !== '').join(' '));
  }
  return lines.join('\n');
}

function cellHtml(cell: LaidOutCell, opts: RenderOptions, hiding: BarHiding): string {
  // The quality is set in a superscript, the way a number chart is written
  // by hand, so a blanked quality is drawn as a superscript too and sits
  // where the quality it stands for would have been.
  const render = (chord: ParsedChord): string => {
    if (hiding === 'all') return escapeHtml(hiddenText(chord, opts, true, 0));
    const parts = chordParts(chord, opts, true);
    // The width comes from the glyph spelling, since that is what this
    // output would have shown: a major seventh is one triangle here, so
    // one dash stands in for it rather than the four of "maj7".
    const width = hiding === 'quality' ? qualityHiddenWidth(chord, opts, true) : parts.quality.length;
    const text = hiding === 'quality' ? dashes(width) : parts.quality;
    const quality = width === 0 ? '' : `<sup>${escapeHtml(text)}</sup>`;
    const written = `${escapeHtml(parts.root)}${quality}${escapeHtml(parts.bass)}`;
    // The colour belongs to the chord rather than to the cell, so that an
    // alternative chord is coloured for what it is instead of inheriting
    // the colour of the chord it stands beside.
    const family = qualityClass(chord);
    return family === null ? written : `<span class="${family}">${written}</span>`;
  };
  const alternative = cell.alternative ? ` <span class="alternative">(${render(cell.alternative)})</span>` : '';
  const small = cell.small ? ' chord-small' : '';
  if (!cell.chord) {
    const own = cellWithoutChordText(cell, opts, true);
    if (own === '' && alternative === '') return '';
    const shown = hiding === 'all' && own !== '' ? hiddenText(null, opts, true, own.length) : own;
    return `<span class="chord${small}">${escapeHtml(shown)}${alternative}</span>`;
  }
  return `<span class="chord${small}">${render(cell.chord)}${alternative}</span>`;
}

/**
 * The chart as HTML for the page.
 *
 * One line of the chart is one element, which is what lets a narrow screen
 * scroll sideways rather than wrap a line a reader expects to hold four
 * bars. Two things deliberately sit outside that line so they cannot eat
 * into its width: a section's heading, which goes on its own line above,
 * and a bar's annotations, which stack under the bar they belong to.
 */
export function renderGridHtml(layout: ChartLayout, opts: RenderOptions): string {
  const endingStarts = endingNumberStarts(layout);
  const blocks: string[] = [];
  let previousSection = -1;
  for (const line of layout.lines) {
    const firstOfSection = line.sectionIndex !== previousSection;
    previousSection = line.sectionIndex;

    // The heading is its own line above the chords rather than a column
    // beside them, which gives every bar of every line the full width to
    // sit in and costs one short line per section instead.
    const heading: string[] = [];
    for (const sign of lineNavigationSigns(layout, line.sectionIndex, firstOfSection)) {
      heading.push(`<span class="navigation">${escapeHtml(sign)}</span>`);
    }
    if (line.sectionLabel !== undefined) {
      heading.push(`<span class="section-label">${escapeHtml(line.sectionLabel)}</span>`);
    }
    if (line.timeSignature !== undefined) {
      heading.push(
        `<span class="time-signature">${line.timeSignature.numerator}/${line.timeSignature.denominator}</span>`,
      );
    }
    if (heading.length > 0) blocks.push(`<div class="chart-heading">${heading.join('')}</div>`);

    const parts: string[] = [];
    for (const bar of line.bars) {
      parts.push(`<span class="bar">${escapeHtml(BARLINE_TEXT[bar.openBarline])}</span>`);
      if (bar.endingNumber !== undefined && endingStarts.has(bar.indexInChart)) {
        parts.push(`<span class="ending">${bar.endingNumber}.</span>`);
      }
      const hiding = barHiding(bar.indexInChart, opts.level);
      const cells = bar.cells.map((cell) => cellHtml(cell, opts, hiding)).filter((html) => html !== '');

      // The bar is a column: its chords on the first row, anything written
      // about the bar underneath them. An annotation beside the chords read
      // as another chord and pushed the rest of the line sideways, which on
      // a narrow screen is what forced the scrolling.
      const below: string[] = [];
      for (const annotation of bar.annotations) {
        below.push(`<span class="annotation">${escapeHtml(annotation.text)}</span>`);
      }
      if (bar.fermata) below.push('<span class="fermata">⌢</span>');
      const under = below.length === 0 ? '' : `<span class="under">${below.join(' ')}</span>`;
      parts.push(`<span class="bar-stack"><span class="measure">${cells.join(' ')}</span>${under}</span>`);
    }
    parts.push(`<span class="bar">${escapeHtml(BARLINE_TEXT[line.closeBarline])}</span>`);
    blocks.push(`<div class="chart-line">${parts.join('')}</div>`);
  }

  const annotations = layout.annotations
    .map((annotation) => `<div class="chart-annotation">${escapeHtml(annotation.text)}</div>`)
    .join('');
  return `<div class="chord-grid">${annotations}${blocks.join('')}</div>`;
}
