/**
 * Extracts the chart metadata iReal Pro carries alongside the chord
 * grid itself — key, tempo, style/groove — from the chart's ABCx (or
 * ABC) header lines, for display in the chart view. The symbol view
 * already shows this through abcjs's own header rendering (title/tempo
 * are standard ABC header fields abcjs engraves on the score itself),
 * but the Nashville/number views bypass abcjs entirely and otherwise
 * show none of it.
 */

export interface ChartMeta {
  /** The literal ABC/ABCx key field text, e.g. "Cm", "Bb", "C". */
  key: string;
  /** Beats per minute, if the chart carries a tempo. */
  bpm?: string;
  /** iReal Pro's style (e.g. "Bossa Nova"), if present. */
  style?: string;
  /** iReal Pro's groove (e.g. "Jazz-Bossa Nova"), if present and distinct from style. */
  groove?: string;
}

function headerValue(source: string, re: RegExp): string | undefined {
  const match = source.match(re);
  return match ? match[1].trim() : undefined;
}

export function parseChartMeta(source: string): ChartMeta {
  const key = headerValue(source, /^K:\s*(\S*)/m) || 'C';
  const bpm = headerValue(source, /^Q:.*=\s*(\d+)\s*$/m);
  const style = headerValue(source, /^%%irealstyle\s+(.*)$/m);
  const groove = headerValue(source, /^%%irealgroove\s+(.*)$/m);
  return { key, bpm, style, groove: groove && groove !== style ? groove : undefined };
}
