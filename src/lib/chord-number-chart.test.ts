import { describe, expect, it } from 'vitest';
import { renderNumberChartHtml } from './chord-number-chart';

describe('renderNumberChartHtml', () => {
  it('splits degree and quality, wrapping the quality in <sup>', () => {
    const html = renderNumberChartHtml('1m7 47 | b7maj7 b3maj7 |');
    expect(html).toContain('<span class="chord">1<sup>m7</sup></span>');
    expect(html).toContain('<span class="chord">4<sup>7</sup></span>');
    expect(html).toContain('<span class="chord">♭7<sup>△</sup></span>');
    expect(html).toContain('<span class="chord">♭3<sup>△</sup></span>');
  });

  it('renders accidentals as unicode flat/sharp glyphs, not ASCII b/#', () => {
    expect(renderNumberChartHtml('b3 |')).toContain('<span class="chord">♭3</span>');
    expect(renderNumberChartHtml('#4 |')).toContain('<span class="chord">♯4</span>');
  });

  it('renders "maj" as the triangle glyph, dropping the redundant 7 in "maj7"', () => {
    expect(renderNumberChartHtml('1maj7 |')).toContain('<span class="chord">1<sup>△</sup></span>');
    expect(renderNumberChartHtml('1maj |')).toContain('<span class="chord">1<sup>△</sup></span>');
    expect(renderNumberChartHtml('1maj9 |')).toContain('<span class="chord">1<sup>△9</sup></span>');
  });

  it('renders "m7b5" (half-diminished) as the ø glyph', () => {
    expect(renderNumberChartHtml('6m7b5 |')).toContain('<span class="chord">6<sup>ø</sup></span>');
  });

  it('drops the redundant 7 when the chart already spells half-diminished as "ø7"', () => {
    expect(renderNumberChartHtml('6ø7 |')).toContain('<span class="chord">6<sup>ø</sup></span>');
  });

  it('renders "dim7" as the degree-sign glyph, dropping the redundant 7', () => {
    expect(renderNumberChartHtml('7dim7 |')).toContain('<span class="chord">7<sup>°</sup></span>');
  });

  it('renders a plain "dim" (diminished triad) as the degree-sign glyph', () => {
    expect(renderNumberChartHtml('7dim |')).toContain('<span class="chord">7<sup>°</sup></span>');
  });

  it('renders bar separators without a quality wrapper', () => {
    const html = renderNumberChartHtml('1 | 4 |');
    expect(html).toContain('<span class="bar">|</span>');
  });

  it('handles a slash (bass note) chord', () => {
    const html = renderNumberChartHtml('1maj7/b3 |');
    expect(html).toContain('<span class="chord">1<sup>△</sup>/♭3</span>');
  });

  it('wraps each source line in its own number-chart-line div', () => {
    const html = renderNumberChartHtml('1 |\n4 |');
    expect(html).toBe(
      '<div class="number-chart-line"><span class="chord">1</span> <span class="bar">|</span></div>' +
        '<div class="number-chart-line"><span class="chord">4</span> <span class="bar">|</span></div>',
    );
  });

  it('leaves a degree with no quality suffix unwrapped', () => {
    const html = renderNumberChartHtml('1 |');
    expect(html).toContain('<span class="chord">1</span>');
    expect(html).not.toContain('<sup>');
  });

  it('escapes stray HTML-significant characters', () => {
    const html = renderNumberChartHtml('<script>');
    expect(html).not.toContain('<script>');
  });

  it('passes through a non-degree token (e.g. a cloze-blanked chord) unchanged but escaped', () => {
    const html = renderNumberChartHtml('---- -- |');
    expect(html).toContain('<span class="chord">----</span>');
    expect(html).toContain('<span class="chord">--</span>');
  });
});
