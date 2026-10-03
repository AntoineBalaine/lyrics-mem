/**
 * Rewrites chord annotations in ABC-notation chord charts into number
 * notation, iReal Pro-style: the chord root is replaced with a scale
 * degree relative to the chart's key, while the quality suffix (maj7,
 * m7, 7#9, ...) is left exactly as-is — e.g. `"Cmaj7"` becomes `"1maj7"`
 * in the key of C.
 *
 * Two numbering systems are offered, matching iReal Pro's own two modes
 * (see abcls-parser's music-theory/numberNotation module for the degree
 * math itself):
 *   - 'nashville': degrees are always measured against the major scale
 *     built on the key's tonic, regardless of the song's actual mode.
 *   - 'numbers': degrees are measured against the song's actual mode's
 *     scale, so a minor-key tune's diatonic chords read with plain
 *     degree numbers instead of being renumbered against the relative
 *     major.
 *
 * This module only rewrites annotation text, the same way chord-cloze.ts
 * only rewrites annotation text for progressive hiding — the two can be
 * applied in sequence (notation first, then cloze) since cloze operates
 * generically on whatever text sits inside the quotes.
 */

import {
  formatDegree,
  nashvilleDegree,
  regularDegree,
  parseKeyRoot,
  parseKeyAccidental,
} from 'abcls-parser';
import { KeyRoot, KeyAccidental, Mode } from 'abcls-parser/types/abcjs-ast';
import type { KeySignature } from 'abcls-parser/types/abcjs-ast';

export type NotationMode = 'symbols' | 'nashville' | 'numbers';

export const NOTATION_MODES: readonly NotationMode[] = ['symbols', 'nashville', 'numbers'] as const;

// Matches a quoted ABC annotation/chord-symbol, e.g. "Cmaj7" or "F#7b9".
// Mirrors chord-cloze.ts's CHORD_ANNOTATION_RE.
const CHORD_ANNOTATION_RE = /"([^"]*)"/g;

function parseKeyMode(str: string): Mode | null {
  switch (str.toLowerCase()) {
    case '':
    case 'major':
    case 'maj':
    case 'ionian':
      return Mode.Major;
    case 'minor':
    case 'min':
    case 'm':
    case 'aeolian':
    case 'aeo':
      return Mode.Minor;
    case 'dorian':
    case 'dor':
      return Mode.Dorian;
    case 'phrygian':
    case 'phr':
      return Mode.Phrygian;
    case 'lydian':
    case 'lyd':
      return Mode.Lydian;
    case 'mixolydian':
    case 'mix':
      return Mode.Mixolydian;
    case 'locrian':
    case 'loc':
      return Mode.Locrian;
    default:
      return null;
  }
}

function parseKeyLexeme(lexeme: string): KeySignature {
  const key: KeySignature = { root: KeyRoot.C, acc: KeyAccidental.None, mode: Mode.Major, accidentals: [] };
  if (lexeme === 'HP' || lexeme === 'Hp') {
    key.root = KeyRoot.HP;
    return key;
  }
  let index = 0;
  if (index < lexeme.length) {
    const root = parseKeyRoot(lexeme[index]);
    if (root) {
      key.root = root;
      index++;
    }
  }
  if (index < lexeme.length && (lexeme[index] === '#' || lexeme[index] === 'b')) {
    key.acc = parseKeyAccidental(lexeme[index]);
    index++;
  }
  const mode = parseKeyMode(lexeme.slice(index));
  if (mode !== null) key.mode = mode;
  return key;
}

/** Extracts the chart's key signature from its ABC `K:` header line. */
export function parseAbcKey(abc: string): KeySignature {
  const match = abc.match(/^K:\s*(\S*)/m);
  if (!match) return { root: KeyRoot.C, acc: KeyAccidental.None, mode: Mode.Major, accidentals: [] };
  return parseKeyLexeme(match[1]);
}

// Matches a chord's root letter + optional accidental at the start of a
// chord-annotation string, e.g. the "Bb" in "Bbmaj7".
const CHORD_ROOT_RE = /^([A-G])([#b]?)/;

function convertRoot(text: string, key: KeySignature, mode: 'nashville' | 'numbers'): string {
  const match = CHORD_ROOT_RE.exec(text);
  if (!match) return text; // not a recognizable chord root — leave untouched
  const [full, letter, acc] = match;
  const root = parseKeyRoot(letter)!;
  const accidental = parseKeyAccidental(acc);
  const spelling =
    mode === 'nashville' ? nashvilleDegree(root, accidental, key) : regularDegree(root, accidental, key);
  return formatDegree(spelling) + text.slice(full.length);
}

function convertChordText(name: string, key: KeySignature, mode: 'nashville' | 'numbers'): string {
  if (!name) return name;
  const slashIndex = name.indexOf('/');
  if (slashIndex === -1) return convertRoot(name, key, mode);
  const main = name.slice(0, slashIndex);
  const bass = name.slice(slashIndex + 1);
  return `${convertRoot(main, key, mode)}/${convertRoot(bass, key, mode)}`;
}

/**
 * Returns the ABC source text with every chord annotation rewritten to
 * the given notation mode. 'symbols' returns the input unchanged.
 */
export function applyNotationMode(mode: NotationMode, abc: string): string {
  if (mode === 'symbols') return abc;
  const key = parseAbcKey(abc);
  return abc.replace(CHORD_ANNOTATION_RE, (_match, name: string) => `"${convertChordText(name, key, mode)}"`);
}
