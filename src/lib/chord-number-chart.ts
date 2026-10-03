/**
 * Renders a plain-text chord chart (as produced by
 * chord-chart-text.ts's extractChordChartBody) as HTML, for the Nashville
 * and regular number-notation views. Unlike the standard chord-symbol
 * view — which is still handed to abcjs for real staff notation — the
 * number views skip staff rendering entirely and just show the chord
 * grid as text, with each chord split into its degree (e.g. "b7") and
 * quality suffix (e.g. "maj7"), the suffix set in a <sup> so it reads
 * the way a musician would actually write a number chart by hand.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Matches a number-notation chord's degree prefix: an optional
// accidental followed by a single scale-degree digit (1-7), e.g. "1",
// "b7", "#4" — restricted to one digit so "47" parses as degree 4 with a
// "7" (dominant) quality suffix, not as a two-digit degree.
const DEGREE_PREFIX_RE = /^([#b]?)([1-7])(.*)$/s;

// Display-only glyph swaps: the underlying text stays plain ASCII
// ("b"/"#", "maj") everywhere else — notably for the "Copy" action, which
// pastes into other tools that expect iReal Pro's own ASCII convention —
// these swaps only affect what's shown on screen.
const ACCIDENTAL_GLYPH: Record<string, string> = { b: '♭', '#': '♯' };

function withQualityGlyphs(quality: string): string {
  // "maj7" collapses to a bare triangle, and "ø7"/"m7b5" (half-diminished
  // is already a 7th chord by definition) collapses to a bare ø — in
  // both cases the "7" is redundant once the glyph itself carries it.
  // "dim7" becomes the degree sign, the standard jazz-chart shorthand
  // for a fully diminished 7th chord.
  return quality
    .replace(/m7b5/g, 'ø')
    .replace(/ø7/g, 'ø')
    .replace(/maj7/g, '△')
    .replace(/maj/g, '△')
    .replace(/dim7/g, '°')
    .replace(/dim/g, '°');
}

/** Splits one chord token (root/bass parts already separated) into HTML with the quality suffix in a <sup>. */
function renderChordPart(part: string): string {
  const match = DEGREE_PREFIX_RE.exec(part);
  if (!match) return escapeHtml(part);
  const [, accidental, digit, quality] = match;
  const degree = (accidental ? ACCIDENTAL_GLYPH[accidental] : '') + digit;
  if (!quality) return escapeHtml(degree);
  return `${escapeHtml(degree)}<sup>${escapeHtml(withQualityGlyphs(quality))}</sup>`;
}

function renderChordToken(token: string): string {
  if (token === '|' || /^[|[\]:]+$/.test(token)) {
    return `<span class="bar">${escapeHtml(token)}</span>`;
  }
  const slashIndex = token.indexOf('/');
  if (slashIndex === -1) return `<span class="chord">${renderChordPart(token)}</span>`;
  const main = token.slice(0, slashIndex);
  const bass = token.slice(slashIndex + 1);
  return `<span class="chord">${renderChordPart(main)}/${renderChordPart(bass)}</span>`;
}

export function renderNumberChartHtml(chartText: string): string {
  const lines = chartText
    .split('\n')
    .map((line) =>
      line
        .split(/\s+/)
        .filter((tok) => tok.length > 0)
        .map(renderChordToken)
        .join(' '),
    )
    .filter((line) => line.length > 0);
  return lines.map((line) => `<div class="number-chart-line">${line}</div>`).join('');
}
