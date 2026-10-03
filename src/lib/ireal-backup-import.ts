// Bulk import from an iReal Pro "HTML backup" export — the page iReal
// Pro's own share/backup feature produces, containing one or more
// `<a href="irealb://...">` links, each itself a playlist bundling many
// songs (iReal Pro's export groups a user's whole library into a handful
// of such playlist links, not one link per song).
import { importAllFromIrealLink, type ImportedChart } from './ireal-import';

const HREF_IREAL_LINK_RE = /href="(irealb:\/\/[^"]*)"/g;

/** Extracts every `irealb://` playlist link from a backup HTML page's markup. */
export function extractIrealLinksFromHtml(html: string): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(HREF_IREAL_LINK_RE)) {
    links.push(match[1]);
  }
  return links;
}

export interface BackupImportResult {
  charts: ImportedChart[];
  // One message per song that failed to convert — collected rather than
  // thrown, so a handful of malformed songs in a large backup don't block
  // importing the rest of the library.
  errors: string[];
}

/**
 * Imports every song found in a backup HTML page's `irealb://` links.
 * Each link can itself bundle many songs (see importAllFromIrealLink);
 * this flattens every song from every link into one result.
 */
export function importLibraryBackup(html: string): BackupImportResult {
  const links = extractIrealLinksFromHtml(html);
  if (links.length === 0) {
    return { charts: [], errors: ['No iRealPro links found in this file.'] };
  }

  const charts: ImportedChart[] = [];
  const errors: string[] = [];
  for (const link of links) {
    const result = importAllFromIrealLink(link);
    charts.push(...result.charts);
    errors.push(...result.errors);
  }
  return { charts, errors };
}
