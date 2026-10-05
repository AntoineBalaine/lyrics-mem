import { describe, expect, it } from 'vitest';
import { ABCContext, layoutChart, parseGrid, parseIrealKey, scanGrid } from 'abcls-parser';
import type { ChartLayout } from 'abcls-parser';
import { renderGridHtml, renderGridText, type RenderOptions } from './chord-grid-render';
import type { ChordLevel } from './chord-cloze';
import type { NotationMode } from './chord-numbers';

/**
 * Tests for the one renderer all three notation views share.
 *
 * Every fixture is raw iReal Pro grid text, which is not ABC: a minor
 * seventh is `D-7` and never `Dm7`, a major seventh is `C^7`, a
 * half-diminished is `Ch7`. Writing a fixture in ABC's dialect makes
 * correct code look broken, which has cost this project real time
 * repeatedly.
 */
function layout(grid: string): ChartLayout {
  const ctx = new ABCContext();
  return layoutChart(parseGrid(scanGrid(grid, ctx), ctx));
}

function options(mode: NotationMode, key: string, level: ChordLevel = 1): RenderOptions {
  return { mode, key: parseIrealKey(key), level };
}

function text(grid: string, mode: NotationMode, key = 'C', level: ChordLevel = 1): string {
  return renderGridText(layout(grid), options(mode, key, level));
}

function html(grid: string, mode: NotationMode, key = 'C', level: ChordLevel = 1): string {
  return renderGridHtml(layout(grid), options(mode, key, level));
}

describe('renderGridText', () => {
  it('writes chord symbols in iReal Pro spelling', () => {
    expect(text('C^7 |D-7 |G7 |C^7 ', 'symbols')).to.equal('| Cmaj7 | Dm7 | G7 | Cmaj7 ||');
  });

  it('writes degrees in a major key', () => {
    expect(text('C^7 |D-7 |G7 ', 'nashville')).to.equal('| 1maj7 | 2m7 | 57 ||');
  });

  it('reads Nashville degrees for a minor key off the relative major', () => {
    // C minor reads against Eb major, so the tonic C is the sixth degree.
    // A dominant seventh on the second degree writes as the degree then
    // the seventh, which the HTML view sets as a superscript.
    expect(text('C-7 |F7 |Bb^7 ', 'nashville', 'C-')).to.equal('| 6m7 | 27 | 5maj7 ||');
  });

  it('reads regular number notation against the parallel major of the song tonic', () => {
    // The same chart in the same key, counted from C rather than from Eb,
    // and spelled against C major, so Bb is the flattened seventh. A
    // degree's accidental then always means a departure from a major
    // scale, whatever mode the song is in.
    expect(text('C-7 |F7 |Bb^7 ', 'numbers', 'C-')).to.equal('| 1m7 | 47 | b7maj7 ||');
  });

  it('spells a minor key degree the way iReal Pro does, against the parallel major', () => {
    // A minor read against A major: C is a semitone under that scale's
    // third, G a semitone under its seventh, and F sharp is its own sixth.
    expect(text('A-7 |C^7 |G7 |F#-7b5 ', 'numbers', 'A-')).to.equal(
      '| 1m7 | b3maj7 | b77 | 6m7b5 ||',
    );
  });

  it('keeps a slash bass and converts it in the number views', () => {
    expect(text('C^7/G ', 'symbols')).to.equal('| Cmaj7/G ||');
    expect(text('C^7/G ', 'numbers')).to.equal('| 1maj7/5 ||');
  });

  it('writes an accidental in ASCII rather than as a glyph', () => {
    // The clipboard is pasted into tools that expect iReal Pro's spelling.
    expect(text('Eb^7 |F#-7 ', 'symbols')).to.equal('| Ebmaj7 | F#m7 ||');
  });

  it('writes repeat barlines and section letters', () => {
    expect(text('[*A{C^7 |D-7 }', 'symbols')).to.equal('[A] |: Cmaj7 | Dm7 :|');
  });

  it('numbers an ending', () => {
    expect(text('{C^7 |N1D-7 }N2G7 ', 'symbols')).to.equal('|: Cmaj7 | 1. Dm7 :| 2. G7 ||');
  });

  it('heads a multi-bar ending with its number once rather than labelling each bar', () => {
    // An ending's number covers the span the way a volta bracket does; one
    // chart in the library ran "1. F | 1. F" before this.
    // The fifth bar starts a new line, which is why the second ending's
    // own second bar appears there.
    expect(text('{C^7 |N1D-7 |E-7 }N2G7 |A-7 ', 'symbols')).to.equal(
      '|: Cmaj7 | 1. Dm7 | Em7 :| 2. G7 |\n| Am7 ||',
    );
  });

  it('writes a chart with no chord as N.C.', () => {
    expect(text('n |C^7 ', 'symbols')).to.equal('| N.C. | Cmaj7 ||');
  });

  it('keeps an alternative chord beside the chord it stands against', () => {
    expect(text('C^7 (A-7)|D-7 ', 'symbols')).to.equal('| Cmaj7 (Am7) | Dm7 ||');
  });

  it('breaks a line every four bars and starts a section on its own line', () => {
    const lines = text('[*AC^7 |D-7 |E-7 |F^7 |G7 ][*BA-7 ', 'symbols').split('\n');
    expect(lines.length).to.equal(3);
    expect(lines[0].startsWith('[A]')).to.equal(true);
    expect(lines[2].startsWith('[B]')).to.equal(true);
  });

  it('hides every chord at the last level and none at the first', () => {
    expect(text('C^7 |D-7 ', 'symbols', 'C', 5)).to.equal('| ----- | --- ||');
    expect(text('C^7 |D-7 ', 'symbols', 'C', 1)).to.equal('| Cmaj7 | Dm7 ||');
  });

  it('hides only the qualities at the second level, keeping every root', () => {
    // A reader still has the harmonic motion and has to recall whether a
    // chord was a major seventh, a dominant or a half-diminished.
    expect(text('C^7 |D-7 |G7 |F ', 'symbols', 'C', 2)).to.equal('| C---- | D-- | G- | F ||');
  });

  it("hides a degree chord's quality the same way", () => {
    expect(text('C^7 |D-7 ', 'numbers', 'C', 2)).to.equal('| 1---- | 2-- ||');
  });

  it('keeps a slash bass visible when only the quality is hidden', () => {
    expect(text('C^7/G ', 'symbols', 'C', 2)).to.equal('| C----/G ||');
  });

  it('leaves a chord with no quality alone at the quality level', () => {
    // A bare major triad has no quality to take away, so it is not given
    // a dash that stands for nothing.
    expect(text('C |D- ', 'symbols', 'C', 2)).to.equal('| C | D- ||');
  });

  it('hides the second and fourth bar of each group at the middle level', () => {
    // The surviving bars keep their qualities hidden, since the level
    // before this one took every quality away.
    expect(text('C^7 |D-7 |E-7 |F^7 ', 'symbols', 'C', 3)).to.equal('| C---- | --- | E-- | ----- ||');
  });

  it('keeps only the first bar of each group at the fourth level', () => {
    expect(text('C^7 |D-7 |E-7 |F^7 ', 'symbols', 'C', 4)).to.equal('| C---- | --- | --- | ----- ||');
  });
});

describe('renderGridHtml', () => {
  it('sets the quality as a superscript and the root as plain text', () => {
    const out = html('C^7 ', 'symbols');
    expect(out).to.contain('C<sup>△</sup>');
  });

  it('writes a major seventh as a bare triangle and keeps a major ninth nine', () => {
    expect(html('C^7 ', 'symbols')).to.contain('△</sup>');
    expect(html('C^7 ', 'symbols')).to.not.contain('△7');
    expect(html('C^9 ', 'symbols')).to.contain('△9');
  });

  it('writes a half-diminished as a bare slashed circle', () => {
    const out = html('Ch7 ', 'symbols');
    expect(out).to.contain('ø');
    expect(out).to.not.contain('ø7');
  });

  it('writes a diminished seventh as the degree sign', () => {
    expect(html('Co7 ', 'symbols')).to.contain('°');
  });

  it('uses unicode accidentals on screen where the clipboard uses ASCII', () => {
    expect(html('Eb^7 ', 'symbols')).to.contain('E♭');
    expect(html('Eb^7 ', 'numbers', 'C')).to.contain('♭3');
  });

  it('escapes an annotation rather than letting it close a tag', () => {
    const out = html('C^7 <a <b>>', 'symbols');
    expect(out).to.contain('&lt;');
    expect(out).to.not.contain('<b>');
  });

  it('gives every line its own element so a narrow screen can scroll', () => {
    const out = html('C^7 |D-7 |E-7 |F^7 |G7 ', 'symbols');
    expect(out.split('class="chart-line"').length - 1).to.equal(2);
  });

  it('names as many chords as the layout holds, in both outputs and every mode', () => {
    // The two outputs come from one traversal precisely so that they cannot
    // disagree about the chart. Counting each against the layout rather than
    // against the other catches either one dropping a cell, which comparing
    // them only to each other would not.
    const grid = '[*A{C^7 |D-7 |N1Eh7 }N2F#o7 ';
    const laidOut = layout(grid);
    const cells = laidOut.lines.reduce(
      (sum, line) => sum + line.bars.reduce((n, bar) => n + bar.cells.filter((c) => c.chord).length, 0),
      0,
    );
    expect(cells).to.be.greaterThan(0);
    for (const mode of ['symbols', 'nashville', 'numbers'] as NotationMode[]) {
      const rendered = html(grid, mode, 'C-');
      const chordSpans = rendered.match(/class="chord(?: chord-small)?"/g) ?? [];
      expect(chordSpans.length, `html for ${mode}`).to.equal(cells);
      // In the plain text a chord is a token that is neither a barline nor
      // an ending number nor a section heading.
      const tokens = text(grid, mode, 'C-')
        .split(/\s+/)
        .filter((t) => t !== '' && !/^[|:]+$/.test(t) && !/^\d+\.$/.test(t) && !/^\[/.test(t));
      expect(tokens.length, `text for ${mode}`).to.equal(cells);
    }
  });
  it('keeps a bare major triad as a bare triangle', () => {
    // About ninety charts in the library write `C^` with no extension.
    expect(html('C^ ', 'symbols')).to.contain('<sup>△</sup>');
  });

  it('writes a diminished triad and a diminished seventh differently', () => {
    // They are different chords, and the library writes both.
    expect(html('Co ', 'symbols')).to.contain('<sup>°</sup>');
    expect(html('Co7 ', 'symbols')).to.contain('<sup>°7</sup>');
  });

  it('writes both spellings of a half-diminished chord the same way', () => {
    // A chart may write either, and showing one chord in two notations on
    // one page is what this normalisation exists to prevent.
    expect(html('Ch7 ', 'symbols')).to.contain('<sup>ø</sup>');
    expect(html('C-7b5 ', 'symbols')).to.contain('<sup>ø</sup>');
  });

  it('writes a sharpened degree with the sharp glyph', () => {
    expect(html('F#^7 ', 'numbers', 'C')).to.contain('♯4');
  });

  it('writes an altered bass degree with its glyph', () => {
    expect(html('C^7/Eb ', 'numbers', 'C')).to.contain('♭3');
  });

  it('emits no superscript for a chord with no quality at all', () => {
    const out = html('C ', 'symbols');
    expect(out).to.contain('class="chord"');
    expect(out).to.not.contain('<sup>');
  });

  it('blanks each chord of a hidden bar to its own width', () => {
    expect(text('C^7 |D-7 A-7 ', 'symbols', 'C', 3)).to.equal('| C---- | --- --- ||');
  });

  it('restarts the four-bar grouping at the fifth bar', () => {
    // The fifth bar begins a new group, so it stays visible at level three
    // while the second, third and fourth do not.
    const out = text('C^7 |D-7 |E-7 |F^7 |G7 |A-7 ', 'symbols', 'C', 4);
    expect(out).to.equal('| C---- | --- | --- | ----- |\n| G- | --- ||');
  });

  it('keeps a section letter visible at the level that hides every chord', () => {
    expect(text('[*AC^7 |D-7 ', 'symbols', 'C', 5)).to.equal('[A] | ----- | --- ||');
  });

  it('blanks a chord in the HTML view as well', () => {
    const out = html('C^7 ', 'symbols', 'C', 5);
    // Two dashes, because "C" and the triangle are what this view shows.
    expect(out).to.contain('--');
    expect(out).to.not.contain('<sup>');
  });

  it('blanks each output to the width that output would have printed', () => {
    // Dashes stand in for what was hidden, so they are as wide as the
    // spelling the output doing the printing uses: a major seventh is one
    // triangle on screen and four characters in the clipboard. Taking both
    // from the ASCII spelling drew four dashes where the page had shown one
    // glyph, which reads as a longer chord than the one being hidden.
    const plain = text('C^7 ', 'symbols', 'C', 5).match(/-+/)?.[0] ?? '';
    // Matched inside the chord element, since the markup's own class names
    // contain hyphens of their own.
    const rendered = html('C^7 ', 'symbols', 'C', 5).match(/class="chord">(-+)</)?.[1] ?? '';
    expect(plain).to.equal('-----');
    expect(rendered).to.equal('--');
  });

  it('blanks a quality to the width of the glyph it replaces', () => {
    // A major seventh shows as a triangle, so one dash stands in for it
    // rather than the four of "maj7".
    const out = html('C^7 ', 'symbols', 'C', 2);
    expect(out).to.contain('<sup>-</sup>');
    expect(out).to.contain('C<sup>');
  });

  it('blanks a longer quality to its own glyph width', () => {
    // A dominant seventh with a flattened ninth shows as "7b9", three
    // characters, so three dashes stand in for it.
    expect(html('C7b9 ', 'symbols', 'C', 2)).to.contain('<sup>---</sup>');
  });

  it('writes an augmented seventh as a raised fifth rather than as aug7', () => {
    expect(text('C7+ ', 'symbols')).to.equal('| C7#5 ||');
    expect(text('C+ ', 'symbols')).to.equal('| Caug ||');
  });

  it('carries annotations and fermatas into the clipboard text as well', () => {
    // Showing them on screen while dropping them from the copy is the one
    // disagreement between the two outputs that must not happen.
    expect(text('C^7 <D.C. al Coda>|D-7 ', 'symbols')).to.contain('<D.C. al Coda>');
    expect(html('C^7 <D.C. al Coda>|D-7 ', 'symbols')).to.contain('D.C. al Coda');
  });

  it('keeps an alternative chord on a cell that names no chord of its own', () => {
    expect(text('n (E7)|C^7 ', 'symbols')).to.contain('(E7)');
    expect(html('n (E7)|C^7 ', 'symbols')).to.contain('class="alternative"');
  });

  it('marks the section a segno or a coda sits on', () => {
    // A coda rendered as an ordinary section reads as music to play
    // through rather than to jump to.
    expect(text('[*AC^7 ][*BQ D-7 ', 'symbols')).to.contain('[Coda]');
    expect(text('[*AC^7 ][*BS D-7 ', 'symbols')).to.contain('[S]');
  });
  it('puts a section heading on its own line above the chords', () => {
    // It used to be a column beside the chords, which cost every line that
    // width; one short line per section costs less.
    const out = html('[*AT44C^7 |D-7 ', 'symbols');
    expect(out).to.contain('<div class="chart-heading">');
    expect(out.indexOf('chart-heading')).to.be.lessThan(out.indexOf('chart-line'));
    expect(out).to.not.contain('class="heading"');
  });

  it('writes no heading line for a line that heads nothing', () => {
    const out = html('C^7 |D-7 |E-7 |F^7 |G7 ', 'symbols');
    expect(out).to.not.contain('chart-heading');
    expect(out.split('class="chart-line"').length - 1).to.equal(2);
  });

  it('stacks a bar annotation under that bar rather than beside it', () => {
    // Beside the chords it read as another chord and pushed the rest of
    // the line sideways.
    const out = html('C^7 <Solos>|D-7 ', 'symbols');
    expect(out).to.contain('<span class="bar-stack">');
    expect(out).to.contain('<span class="under"><span class="annotation">Solos</span></span>');
    // The annotation comes after the chords of its own bar, and before the
    // barline that ends it.
    const stack = out.slice(out.indexOf('bar-stack'), out.indexOf('class="bar"', out.indexOf('bar-stack')));
    expect(stack.indexOf('measure')).to.be.lessThan(stack.indexOf('under'));
  });

  it('gives a bar with nothing written about it no second row', () => {
    expect(html('C^7 |D-7 ', 'symbols')).to.not.contain('class="under"');
  });

  it('stacks a fermata under its bar too', () => {
    expect(html('fC^7 |D-7 ', 'symbols')).to.contain('class="under"');
  });

  describe('colour by chord quality', () => {
    const family = (grid: string): string[] =>
      [...html(grid, 'symbols').matchAll(/class="(quality-[a-z-]+)"/g)].map((m) => m[1]);

    it('colours a dominant, a minor, a major and a half-diminished', () => {
      expect(family('C7 |D-7 |E^7 |Fh7 ')).to.deep.equal([
        'quality-dominant',
        'quality-minor',
        'quality-major',
        'quality-half-diminished',
      ]);
    });

    it('colours a bare triad as major, not as a dominant', () => {
      // The dialect writes a dominant as the absence of a quality symbol,
      // so a bare `C` parses as a dominant with no extension; musically it
      // is a major triad and red is for one that names a seventh.
      expect(family('C ')).to.deep.equal(['quality-major']);
    });

    it('colours both spellings of a half-diminished chord the same', () => {
      expect(family('Ch7 |C-7b5 ')).to.deep.equal([
        'quality-half-diminished',
        'quality-half-diminished',
      ]);
    });

    it('colours an altered chord as the dominant it is', () => {
      expect(family('C7alt ')).to.deep.equal(['quality-dominant']);
    });

    it('colours a suspended chord that names a seventh as a dominant', () => {
      // The suspension replaces the third; it does not change what the
      // chord is doing, and the seventh is still there.
      expect(family('A7sus |C9sus |G7sus2 ')).to.deep.equal([
        'quality-dominant',
        'quality-dominant',
        'quality-dominant',
      ]);
    });

    it('colours an augmented chord that names a seventh as a dominant', () => {
      // iReal Pro writes this one `C7+`, and it is a dominant seventh over
      // a raised fifth; the chord text spells it `C7#5`.
      expect(family('C7+ ')).to.deep.equal(['quality-dominant']);
    });

    it('reads a suspended chord with no seventh as a minor chord', () => {
      expect(family('Csus |Csus2 ')).to.deep.equal(['quality-minor', 'quality-minor']);
    });

    it('reads a diminished seventh as a dominant', () => {
      expect(family('Co7 ')).to.deep.equal(['quality-dominant']);
    });

    it('reads a minor major seventh and its ninth as minor chords', () => {
      expect(family('C-^7 |C-^9 ')).to.deep.equal(['quality-minor', 'quality-minor']);
    });

    it('reads an augmented triad as a major chord', () => {
      expect(family('C+ ')).to.deep.equal(['quality-major']);
    });

    it('reads an added chord as major, since what it adds is not a seventh', () => {
      // The extension names the note being added rather than a stack, so
      // `Cadd9` carries no seventh where `C9` does.
      expect(family('Cadd9 |C9 ')).to.deep.equal(['quality-major', 'quality-dominant']);
    });

    it('colours a sixth chord as major, since a sixth is not a seventh', () => {
      expect(family('C6 |C^7 ')).to.deep.equal(['quality-major', 'quality-major']);
    });

    it('leaves the two families that have had no ruling uncoloured', () => {
      // A bare diminished triad and a diminished major seventh. A power
      // chord too, which names neither a third nor a seventh.
      expect(family('Co |Co^7 |C5 ')).to.deep.equal([]);
    });

    it('colours an alternative chord for what it is, not for its neighbour', () => {
      expect(family('C^7 (A-7)')).to.deep.equal(['quality-major', 'quality-minor']);
    });

    it('colours the degree views too, since the quality is the same chord', () => {
      const degrees = [...html('C7 |D-7 ', 'numbers').matchAll(/class="(quality-[a-z-]+)"/g)].map((m) => m[1]);
      expect(degrees).to.deep.equal(['quality-dominant', 'quality-minor']);
    });

    it('takes no colour from a chord the level has hidden', () => {
      // Colouring dashes would hand back the quality the level removed.
      expect(family('C^7 |D-7 ')).to.not.deep.equal([]);
      expect([...html('C^7 |D-7 ', 'symbols', 'C', 5).matchAll(/class="quality-/g)]).to.deep.equal([]);
    });
  });
});
