import type { ChartLayout, IrealBarline, LaidOutBar, LaidOutLine } from 'abcls-parser';

type TimeSignature = NonNullable<LaidOutLine['timeSignature']>;

/**
 * Breaks a chart's bars into lines the way iReal Pro draws them.
 *
 * Every line of a chart holds the same number of bars, four or eight, so
 * that the bars form one fixed grid. A section always starts a line of its
 * own, and a second ending starts under the first.
 */

/** A line that also says how many empty bar slots come before its first bar. */
export interface FlowedLine extends LaidOutLine {
  offset: number;
  /** Every parser section this line's section holds, for the markers on them. */
  sectionIndexes: number[];
  /** A change of meter partway along the line, by the position of its bar. */
  meterChanges: { position: number; timeSignature: TimeSignature }[];
}

export interface FlowedLayout extends ChartLayout {
  lines: FlowedLine[];
  /** How many bar slots every line has, which is the width of the grid. */
  barsPerLine: number;
}

/** The widest a bar can be written, in cells, and still count as one of eight to a line. */
export const NARROW_BAR_CELLS = 2;

interface SectionBars {
  first: LaidOutLine;
  bars: LaidOutBar[];
  /** The parser sections folded into this one, which markers refer to. */
  sectionIndexes: number[];
  /** The meter that a bar begins, for a bar that begins one partway through. */
  meterChanges: Map<LaidOutBar, TimeSignature>;
}

interface Row {
  offset: number;
  bars: LaidOutBar[];
}

/**
 * The barline that stands between a line's last bar and the next line's
 * first, put back together from its two halves.
 *
 * Because the layout prints what closes at the end of one line and what
 * opens at the start of the next, a bar that begins a line carries only
 * the opening half. Re-flowing the bars needs the whole barline, since a
 * bar that began a line may now sit in the middle of one.
 */
export function joinBarline(closing: IrealBarline, opening: IrealBarline): IrealBarline {
  if (closing === 'closeRepeat') return opening === 'openRepeat' ? 'closeOpenRepeat' : 'closeRepeat';
  return opening;
}

export function closingHalf(barline: IrealBarline): IrealBarline {
  return barline === 'closeRepeat' || barline === 'closeOpenRepeat' ? 'closeRepeat' : 'plain';
}

export function openingHalf(barline: IrealBarline): IrealBarline {
  return barline === 'openRepeat' || barline === 'closeOpenRepeat' ? 'openRepeat' : 'plain';
}

/**
 * The chart's bars in reading order, each with the whole barline to its left,
 * gathered into the sections they came from.
 */
export function gatherSections(layout: ChartLayout): SectionBars[] {
  const sections: SectionBars[] = [];
  let previousLine: LaidOutLine | undefined;
  let parserSection = -1;
  for (const line of layout.lines) {
    // The parser also starts a section wherever the meter changes, but iReal
    // Pro carries on along the same line and writes the new meter above the
    // bar, so a section that exists only because of a meter change is folded
    // into the one before. Any other section, a coda among them, keeps its
    // own lines even when it has no label.
    let section = sections[sections.length - 1];
    if (section === undefined || !isMeterChangeOnly(line, parserSection, layout)) {
      section = { first: line, bars: [], sectionIndexes: [], meterChanges: new Map() };
      sections.push(section);
    }
    const startsParserSection = line.sectionIndex !== parserSection;
    if (startsParserSection) section.sectionIndexes.push(line.sectionIndex);
    parserSection = line.sectionIndex;

    line.bars.forEach((bar, position) => {
      const whole =
        position === 0 && previousLine !== undefined
          ? joinBarline(previousLine.closeBarline, bar.openBarline)
          : bar.openBarline;
      const copy = { ...bar, openBarline: whole };
      if (position === 0 && startsParserSection && line !== section.first && line.timeSignature !== undefined) {
        section.meterChanges.set(copy, line.timeSignature);
      }
      section.bars.push(copy);
    });
    previousLine = line;
  }
  return sections;
}

/**
 * Whether a line begins a section that the parser made only because the
 * meter changed: a new section with no label, a meter of its own, and no
 * navigation marker, since a coda or a segno is a place to jump to.
 */
export function isMeterChangeOnly(line: LaidOutLine, previousParserSection: number, layout: ChartLayout): boolean {
  if (line.sectionIndex === previousParserSection) return true;
  if (line.sectionLabel !== undefined || line.timeSignature === undefined) return false;
  const nav = layout.navigation;
  return (
    nav.codaSectionIndex !== line.sectionIndex &&
    nav.segnoSectionIndex !== line.sectionIndex &&
    !nav.partMarkerSections.includes(line.sectionIndex)
  );
}

/**
 * Chooses four or eight bars to a line, once for the whole chart.
 *
 * Because iReal Pro draws a row sixteen cells wide, a chart that writes its
 * bars two cells wide, the way the chorinhos are written, is drawn eight
 * to a line, and a chart that writes them four cells wide is drawn four to
 * a line. The width most bars are written at decides, so that one odd bar
 * cannot change the shape of the whole chart.
 */
export function chooseBarsPerLine(sections: SectionBars[]): number {
  const widths = sections.flatMap((section) => section.bars.map((bar) => bar.cellCount));
  if (widths.length === 0) return 4;
  const narrow = widths.filter((width) => width <= NARROW_BAR_CELLS).length;
  return narrow * 2 > widths.length ? 8 : 4;
}

/**
 * Lays one section's bars onto rows of `slots` bars.
 *
 * The first ending follows the bars before it on the same row. Because the
 * repeat is a second pass over the same place, the second ending goes on
 * the next row at the column the first one started in, with the slots
 * before it left empty, so that the two stand one above the other.
 */
export function flowSection(bars: LaidOutBar[], slots: number): Row[] {
  const rows: Row[] = [{ offset: 0, bars: [] }];
  let column = 0;
  let firstEndingColumn: number | undefined;
  let previousEnding: number | undefined;

  for (const bar of bars) {
    const ending = bar.endingNumber;
    const startsEnding = ending !== undefined && ending !== previousEnding;
    if (startsEnding && ending > 1) {
      column = firstEndingColumn ?? 0;
      rows.push({ offset: column, bars: [] });
    } else if (column >= slots) {
      column = 0;
      rows.push({ offset: 0, bars: [] });
    }
    if (startsEnding && ending === 1) firstEndingColumn = column;
    if (ending === undefined) firstEndingColumn = undefined;

    rows[rows.length - 1].bars.push(bar);
    column++;
    previousEnding = ending;
  }
  return rows;
}

/**
 * The chart as lines of equal length, ready to be drawn on a fixed grid.
 */
export function flowChart(layout: ChartLayout): FlowedLayout {
  const sections = gatherSections(layout);
  const slots = chooseBarsPerLine(sections);

  const flowed: { line: FlowedLine; whole: IrealBarline[] }[] = [];
  for (const section of sections) {
    const rows = flowSection(section.bars, slots);
    rows.forEach((row, position) => {
      const line: FlowedLine = {
        bars: row.bars,
        closeBarline: 'plain',
        sectionIndex: section.first.sectionIndex,
        sectionIndexes: section.sectionIndexes,
        offset: row.offset,
        meterChanges: row.bars.flatMap((bar, at) => {
          const timeSignature = section.meterChanges.get(bar);
          return timeSignature === undefined ? [] : [{ position: at, timeSignature }];
        }),
      };
      if (position === 0) {
        if (section.first.sectionLabel !== undefined) line.sectionLabel = section.first.sectionLabel;
        if (section.first.timeSignature !== undefined) line.timeSignature = section.first.timeSignature;
      }
      flowed.push({ line, whole: row.bars.map((bar) => bar.openBarline) });
    });
  }

  // A barline between two bars is split between the line it ends and the
  // line it begins, so each line takes the half that belongs to it.
  flowed.forEach((entry, position) => {
    const next = flowed[position + 1];
    entry.line.closeBarline =
      next === undefined
        ? (layout.lines[layout.lines.length - 1]?.closeBarline ?? 'final')
        : closingHalf(next.whole[0] ?? 'plain');
  });
  for (const entry of flowed) {
    entry.line.bars = entry.line.bars.map((bar, position) =>
      position === 0 ? { ...bar, openBarline: openingHalf(bar.openBarline) } : bar,
    );
  }

  const lines = flowed.map((entry) => entry.line);
  return { lines, navigation: layout.navigation, annotations: layout.annotations, barsPerLine: slots };
}
