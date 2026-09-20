// Converts a pasted iRealPro chord-chart URL into real ABC text, using
// AbcLs (imported as the `abcls-parser` npm dependency, see package.json's
// `file:` reference to /tank/projects/AbcLs/parse) for both steps of the
// pipeline: iRealPro link -> ABCx (chord-only) text -> real ABC text.
// This conversion runs entirely client-side, at import time only — there
// is no server-side component, matching the rest of this app's no-backend
// IndexedDB storage pattern.
import { ABCContext, convertAbcxToAbc, importIrealLinkToAbcx } from 'abcls-parser';

export interface ImportedChart {
  title: string;
  composer: string;
  abc: string;
  // The intermediate ABCx (chord-only) text this chart's ABC was
  // converted from, kept only for debugging the conversion pipeline —
  // shown on the chart page below the rendered score, not otherwise used.
  abcx: string;
}

function parseHeaderField(abc: string, field: 'T' | 'C'): string {
  const re = new RegExp(`^${field}:\\s*(.*)$`, 'm');
  const match = abc.match(re);
  return match ? match[1].trim() : '';
}

/**
 * Takes a single `irealb://...` playlist link (iRealPro's export URL
 * format) and returns the first tune it contains as real ABC text, plus
 * its title/composer parsed from the ABC header. If the link contains
 * multiple tunes, only the first is imported — multi-tune playlists are
 * out of scope for this proof of concept.
 */
export function importIrealLink(link: string): ImportedChart {
  const trimmed = link.trim();
  if (!trimmed) throw new Error('Paste an iRealPro link first.');
  if (!trimmed.startsWith('irealb://')) {
    throw new Error(
      'That doesn\'t look like an iRealPro link (expected it to start with "irealb://").',
    );
  }

  const abcx = importIrealLinkToAbcx(trimmed);
  // Multiple tunes are separated by a blank line by importIrealLinkToAbcx;
  // only the first is used here.
  const firstTune = abcx.split(/\n\s*\n/)[0];

  const ctx = new ABCContext();
  const abc = convertAbcxToAbc(firstTune, ctx);
  if (ctx.errorReporter.hasErrors()) {
    const messages = ctx.errorReporter
      .getErrors()
      .map((e) => e.message)
      .join('; ');
    throw new Error(`Could not convert this chart to ABC: ${messages}`);
  }

  const title = parseHeaderField(abc, 'T') || 'Untitled';
  const composer = parseHeaderField(abc, 'C') || 'Unknown';

  return { title, composer, abc, abcx: firstTune };
}
