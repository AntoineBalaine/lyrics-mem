import { describe, expect, it } from 'vitest';
import { extractIrealLinksFromHtml, importLibraryBackup } from './ireal-backup-import';
import { DEMO_CHARTS } from './chords-demo-seed';

/**
 * A second real link, kept here rather than taken from the demo list.
 * These tests need two distinct songs, and reading them out of a list that
 * exists to populate the page's demo buttons made shortening that list
 * break them.
 */
const AUTUMN_LEAVES =
  'irealb://Autumn Leaves=Kosma== =Cm=0=1r34LbKcu7ZL7F 7LZ BL7-G 7-G ZL7D b57-A ZL7^bE 7^bZ C-7F 7-C Bb^7 Eb^7LZ A-7b5 D7LZ G-7 G-7LZ== =';
const ALL_OF_ME = DEMO_CHARTS[0].link;

function hrefHtml(links: string[]): string {
  return [
    '<html><body><ul>',
    ...links.map((link) => `<li><a href="${link}">song</a></li>`),
    '</ul></body></html>',
  ].join('\n');
}

describe('extractIrealLinksFromHtml', () => {
  it('extracts every irealb:// href from the page', () => {
    const html = hrefHtml([ALL_OF_ME, AUTUMN_LEAVES]);
    expect(extractIrealLinksFromHtml(html)).toEqual([ALL_OF_ME, AUTUMN_LEAVES]);
  });

  it('returns an empty array when there are no iReal links', () => {
    expect(extractIrealLinksFromHtml('<html><body>nothing here</body></html>')).toEqual([]);
  });

  it('ignores non-iRealPro hrefs', () => {
    const html = `<a href="https://example.com">x</a><a href="${ALL_OF_ME}">y</a>`;
    expect(extractIrealLinksFromHtml(html)).toEqual([ALL_OF_ME]);
  });
});

describe('importLibraryBackup', () => {
  it('imports every song from every link found in the page', () => {
    const html = hrefHtml([ALL_OF_ME, AUTUMN_LEAVES]);
    const result = importLibraryBackup(html);
    expect(result.errors).toEqual([]);
    expect(result.charts.map((c) => c.title).sort()).toEqual(['All Of Me - jsb', 'Autumn Leaves'].sort());
  });

  it('reports an error when the page has no iReal links', () => {
    const result = importLibraryBackup('<html><body>empty</body></html>');
    expect(result.charts).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });
});
