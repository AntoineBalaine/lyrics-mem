/**
 * The three ways the chart view can spell a chord.
 *
 * All that is left here is the mode itself. The degree arithmetic lives in
 * the parser package's music-theory/numberNotation module, and the chord
 * rendering in chord-grid-render.ts, which reads a parsed chord rather
 * than rewriting chord text the way this module used to.
 *
 *   - 'symbols':   the chord as written, Cmaj7.
 *   - 'nashville': a degree against the major scale on the key's tonic,
 *     or on its relative major when the key is minor, which is what the
 *     Nashville Number System does.
 *   - 'numbers':   a degree against the major scale on the song's own
 *     tonic, which is iReal Pro's own number notation. A minor key is
 *     read against its parallel major, so the accidental in a degree
 *     always means a departure from a major scale.
 */

export type NotationMode = 'symbols' | 'nashville' | 'numbers';

export const NOTATION_MODES: readonly NotationMode[] = ['symbols', 'nashville', 'numbers'] as const;
