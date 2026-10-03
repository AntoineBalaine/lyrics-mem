import { describe, expect, it } from 'vitest';
import { extractIrealLinksFromHtml, importLibraryBackup } from './ireal-backup-import';
import { DEMO_CHARTS } from './chords-demo-seed';

function hrefHtml(links: string[]): string {
  return [
    '<html><body><ul>',
    ...links.map((link) => `<li><a href="${link}">song</a></li>`),
    '</ul></body></html>',
  ].join('\n');
}

describe('extractIrealLinksFromHtml', () => {
  it('extracts every irealb:// href from the page', () => {
    const html = hrefHtml([DEMO_CHARTS[0].link, DEMO_CHARTS[1].link]);
    expect(extractIrealLinksFromHtml(html)).toEqual([DEMO_CHARTS[0].link, DEMO_CHARTS[1].link]);
  });

  it('returns an empty array when there are no iReal links', () => {
    expect(extractIrealLinksFromHtml('<html><body>nothing here</body></html>')).toEqual([]);
  });

  it('ignores non-iRealPro hrefs', () => {
    const html = `<a href="https://example.com">x</a><a href="${DEMO_CHARTS[0].link}">y</a>`;
    expect(extractIrealLinksFromHtml(html)).toEqual([DEMO_CHARTS[0].link]);
  });
});

describe('importLibraryBackup', () => {
  it('imports every song from every link found in the page', () => {
    const html = hrefHtml(DEMO_CHARTS.map((c) => c.link));
    const result = importLibraryBackup(html);
    expect(result.errors).toEqual([]);
    expect(result.charts.map((c) => c.title).sort()).toEqual(
      ['All Of Me - jsb', 'Autumn Leaves', 'Black Orpheus'].sort(),
    );
  });

  it('reports an error when the page has no iReal links', () => {
    const result = importLibraryBackup('<html><body>empty</body></html>');
    expect(result.charts).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });
});
