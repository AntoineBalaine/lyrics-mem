import {
  addChordChart,
  addChordCharts,
  deleteChordChart,
  getChordChart,
  listChordCharts,
  type ChordChartRecord,
} from './chords-db';
import { applyFlagsFromUrl, isPersistenceEnabled, setPersistenceEnabled } from './feature-flags';
import { CHORD_LEVELS, type ChordLevel } from './chord-cloze';
import { renderGridHtml, renderGridText } from './chord-grid-render';
import { NOTATION_MODES, type NotationMode } from './chord-numbers';
import { DEMO_CHARTS } from './chords-demo-seed';
import { importIrealLink, prepareChart } from './ireal-import';
import { importLibraryBackup } from './ireal-backup-import';

type View = 'library' | 'chart';

interface UrlState {
  view: View;
  id?: string;
  level?: ChordLevel;
  notation?: NotationMode;
}

function readNotationMode(raw: string | null): NotationMode {
  return (NOTATION_MODES as readonly string[]).includes(raw ?? '') ? (raw as NotationMode) : 'symbols';
}

function readUrl(): UrlState {
  const p = new URLSearchParams(location.search);
  const view = p.get('view') === 'chart' ? 'chart' : 'library';
  const id = p.get('id') ?? undefined;
  const rawLevel = parseInt(p.get('level') ?? '1', 10);
  // Clamped against the number of levels there are rather than a literal,
  // so that adding one cannot leave the URL unable to name it.
  const level = (
    Number.isFinite(rawLevel) ? Math.max(1, Math.min(CHORD_LEVELS.length, rawLevel)) : 1
  ) as ChordLevel;
  const notation = readNotationMode(p.get('notation'));
  return { view, id, level, notation };
}

function writeUrl(state: UrlState, push: boolean): void {
  const p = new URLSearchParams();
  if (state.view !== 'library') p.set('view', state.view);
  if (state.id) p.set('id', state.id);
  if (state.view === 'chart' && state.level && state.level !== 1) {
    p.set('level', String(state.level));
  }
  if (state.view === 'chart' && state.notation && state.notation !== 'symbols') {
    p.set('notation', state.notation);
  }
  const qs = p.toString();
  const url = qs ? `?${qs}` : location.pathname;
  if (push) history.pushState({ ...state }, '', url);
  else history.replaceState({ ...state }, '', url);
}

function navigate(state: UrlState): void {
  writeUrl(state, true);
  void route();
}

function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found`);
  return el as T;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showView(view: View): void {
  $('view-library').hidden = view !== 'library';
  $('view-chart').hidden = view !== 'chart';
}

// ─────────────────────────────────────────────────────────────
// Library view
// ─────────────────────────────────────────────────────────────

type LibrarySort = 'recent' | 'title';

// Kept at module scope rather than re-read from the DOM each render so
// they survive a full renderLibrary() re-render (e.g. after a delete)
// without losing what the user had typed/selected.
let librarySearch = '';
let librarySort: LibrarySort = 'recent';

async function renderLibrary(): Promise<void> {
  const allCharts = await listChordCharts();

  const query = librarySearch.trim().toLowerCase();
  const charts = query
    ? allCharts.filter((c) => c.title.toLowerCase().includes(query) || c.composer.toLowerCase().includes(query))
    : allCharts;

  if (librarySort === 'title') {
    charts.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    charts.sort((a, b) => b.savedAt - a.savedAt);
  }

  const list = $<HTMLUListElement>('library-list');
  const empty = $('library-empty');
  const noResults = $('library-no-results');

  list.innerHTML = charts
    .map(
      (c) => `
      <li>
        <a href="?view=chart&id=${encodeURIComponent(c.id)}" data-id="${escapeHtml(c.id)}" class="library-item">
          <span class="lib-title">${escapeHtml(c.title)}</span>
          <span class="lib-composer">${escapeHtml(c.composer)}</span>
        </a>
        <button class="link danger" data-delete-id="${escapeHtml(c.id)}">delete</button>
      </li>`,
    )
    .join('');

  empty.hidden = allCharts.length > 0;
  noResults.hidden = allCharts.length === 0 || charts.length > 0;
  $('library-count').textContent = `${charts.length} chart${charts.length === 1 ? '' : 's'}`;

  list.querySelectorAll<HTMLAnchorElement>('a.library-item').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigate({ view: 'chart', id: a.dataset.id!, level: 1 });
    });
  });
  list.querySelectorAll<HTMLButtonElement>('button[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.dataset.deleteId!;
      if (!confirm('Delete this chart?')) return;
      await deleteChordChart(id);
      await renderLibrary();
    });
  });
}

async function runImport(): Promise<void> {
  const input = $<HTMLInputElement>('import-url');
  const status = $('import-status');
  const link = input.value.trim();
  if (!link) {
    status.textContent = 'Paste an iRealPro link first.';
    return;
  }
  status.textContent = 'Converting…';
  try {
    const { title, composer, link: songLink } = importIrealLink(link);
    const saved = await addChordChart({ title, composer, link: songLink });
    input.value = '';
    status.textContent = '';
    navigate({ view: 'chart', id: saved.id, level: 1 });
  } catch (err) {
    status.textContent = err instanceof Error ? err.message : String(err);
  }
}

/**
 * Reads a chosen file as text.
 *
 * Blob.text is used where it exists, and FileReader where it does not,
 * because the mobile browsers that lack the first are exactly the ones a
 * library backup gets imported from.
 */
async function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsText(file);
  });
}

// Imports every song found in an iRealPro "HTML backup" export (the
// user's whole library, bundled as a handful of multi-song playlist
// links) and adds each one to the chart library. Charts whose title and
// composer already match an existing chart overwrite it (addChordChart's
// id is derived from title+composer — see chord-key.ts's chordSlug),
// rather than growing duplicates on a re-import of the same backup.
async function runBackupImport(file: File, input?: HTMLInputElement): Promise<void> {
  const status = $('backup-import-status');
  status.textContent = `Reading ${file.name || 'backup file'}…`;
  try {
    const html = await readFileText(file);
    // Reset only now that the file has been read, so that choosing the
    // same file again still triggers a fresh import.
    if (input) input.value = '';
    if (html.trim() === '') {
      status.textContent = `Could not read any text out of ${file.name || 'that file'}.`;
      return;
    }
    const { charts, errors } = importLibraryBackup(html);
    status.textContent = `Importing ${charts.length} chart${charts.length === 1 ? '' : 's'}…`;
    // One write rather than several hundred: a backup holds the whole
    // library, and a transaction apiece made importing one visibly slow.
    await addChordCharts(charts);
    await renderLibrary();
    const parts = [`Imported ${charts.length} chart${charts.length === 1 ? '' : 's'}.`];
    if (errors.length > 0) {
      parts.push(`${errors.length} song${errors.length === 1 ? '' : 's'} could not be converted.`);
    }
    status.textContent = parts.join(' ');
  } catch (err) {
    if (input) input.value = '';
    // An error from a file read on a phone can carry an empty message, and
    // reporting that leaves the page looking as though nothing happened,
    // so the name of the condition stands in for it.
    const message = err instanceof Error ? err.message || err.name : String(err);
    status.textContent = `Could not read that file: ${message || 'unknown error'}.`;
  }
}

// ─────────────────────────────────────────────────────────────
// Chart view (level switcher, text grid render)
// ─────────────────────────────────────────────────────────────

interface ChartViewState {
  chart: ChordChartRecord;
  level: ChordLevel;
  notation: NotationMode;
}
let chartView: ChartViewState | null = null;

// The plain-text form of exactly what is on screen, kept so that the copy
// action and the view can never disagree: both come from one render.
let currentChartText = '';

function renderAtCurrentLevel(): void {
  if (!chartView) return;
  const { chart, level, notation } = chartView;
  $('chart-level-num').textContent = String(level);
  $('chart-level-total').textContent = String(CHORD_LEVELS.length);
  document.querySelectorAll<HTMLButtonElement>('button[data-notation]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.notation === notation));
  });

  // The chart is scanned, parsed and laid out on every render rather than
  // cached, since the chart's link is all that is stored and parsing one
  // costs far less than a frame.
  //
  // A chart that cannot be read says so where the chart would be. Without
  // this the thrown error escapes into a click handler and leaves the
  // previous chart's grid on screen under the new chart's title, which
  // reads as the wrong chart rather than as a failure.
  let prepared: ReturnType<typeof prepareChart>;
  try {
    prepared = prepareChart(chart.link);
  } catch (err) {
    $('chart-meta').innerHTML = '';
    $('chart-score').innerHTML = `<p class="error">${escapeHtml(
      err instanceof Error ? err.message : String(err),
    )}</p>`;
    currentChartText = '';
    return;
  }
  const { layout, key, metadata } = prepared;

  const metaParts = [`Key: ${metadata.key}`];
  if (metadata.bpm) metaParts.push(`${metadata.bpm} bpm`);
  if (metadata.style) metaParts.push(metadata.style);
  if (metadata.groove) metaParts.push(metadata.groove);
  $('chart-meta').innerHTML = metaParts.map((p) => `<span>${escapeHtml(p)}</span>`).join('');

  // All three notation modes draw the same grid through the same renderer,
  // differing only in what each cell prints. They used to be two code
  // paths, one of them through staff engraving, and drifted apart every
  // time either was touched.
  const options = { mode: notation, key, level };
  $('chart-score').innerHTML = renderGridHtml(layout, options);
  currentChartText = renderGridText(layout, options);

  const prevBtn = $<HTMLButtonElement>('btn-level-prev');
  const nextBtn = $<HTMLButtonElement>('btn-level-next');
  prevBtn.disabled = level <= 1;
  nextBtn.disabled = level >= CHORD_LEVELS.length;
}

async function renderChart(id: string, level: ChordLevel, notation: NotationMode): Promise<void> {
  const chart = await getChordChart(id);
  if (!chart) {
    navigate({ view: 'library' });
    return;
  }
  chartView = { chart, level, notation };
  $('chart-title').textContent = `${chart.title} — ${chart.composer}`;
  document.title = `${chart.title} - ${chart.composer}`;
  renderAtCurrentLevel();
}

function setLevel(level: ChordLevel): void {
  if (!chartView) return;
  chartView.level = level;
  renderAtCurrentLevel();
  writeUrl({ view: 'chart', id: chartView.chart.id, level, notation: chartView.notation }, true);
}

let copyStatusTimer: ReturnType<typeof setTimeout> | undefined;

function showCopyStatus(text: string): void {
  const status = $('copy-status');
  status.textContent = text;
  clearTimeout(copyStatusTimer);
  copyStatusTimer = setTimeout(() => {
    status.textContent = '';
  }, 2000);
}

// Falls back to the legacy execCommand('copy') path via a hidden textarea
// when navigator.clipboard is unavailable — notably, Clipboard.writeText
// requires a secure context (HTTPS or localhost), which plain
// http://debianhome.local does not qualify as.
function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } finally {
    textarea.remove();
  }
  return ok;
}

// Copies the chord grid as it currently stands, cloze level and notation
// mode included, in iReal Pro's own ASCII spelling rather than in the
// unicode glyphs the page shows, since a chart pasted elsewhere is read by
// tools that expect that convention.
async function copyCurrentChart(): Promise<void> {
  const text = currentChartText;
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      showCopyStatus('Copied!');
      return;
    } catch {
      // Fall through to the legacy path below.
    }
  }
  showCopyStatus(legacyCopy(text) ? 'Copied!' : 'Copy failed — select the chart and copy it manually.');
}

function setNotationMode(notation: NotationMode): void {
  if (!chartView) return;
  chartView.notation = notation;
  renderAtCurrentLevel();
  writeUrl({ view: 'chart', id: chartView.chart.id, level: chartView.level, notation }, true);
}

// ─────────────────────────────────────────────────────────────
// Router + boot
// ─────────────────────────────────────────────────────────────

async function route(): Promise<void> {
  const state = readUrl();
  showView(state.view);
  switch (state.view) {
    case 'library':
      await renderLibrary();
      break;
    case 'chart':
      if (!state.id) {
        navigate({ view: 'library' });
        return;
      }
      if (!chartView || chartView.chart.id !== state.id) {
        await renderChart(state.id, state.level ?? 1, state.notation ?? 'symbols');
      } else {
        chartView.level = state.level ?? 1;
        chartView.notation = state.notation ?? 'symbols';
        renderAtCurrentLevel();
      }
      break;
  }
}

function bind(): void {
  const search = $<HTMLInputElement>('library-search');
  const clearSearch = $<HTMLButtonElement>('btn-clear-search');
  // The button has nothing to clear while the field is empty, so it only
  // appears once something has been typed.
  const syncClearButton = (): void => {
    clearSearch.hidden = search.value === '';
  };
  search.addEventListener('input', () => {
    librarySearch = search.value;
    syncClearButton();
    void renderLibrary();
  });
  clearSearch.addEventListener('click', () => {
    search.value = '';
    librarySearch = '';
    syncClearButton();
    // Returns focus to the field, so that clearing a query and typing a
    // new one does not need a second tap.
    search.focus();
    void renderLibrary();
  });
  syncClearButton();
  $<HTMLSelectElement>('library-sort').addEventListener('change', (e) => {
    librarySort = (e.target as HTMLSelectElement).value as LibrarySort;
    void renderLibrary();
  });

  const persist = $<HTMLInputElement>('flag-persist');
  persist.checked = isPersistenceEnabled();
  persist.addEventListener('change', () => {
    setPersistenceEnabled(persist.checked);
    // The library is re-read rather than migrated, so the charts on the
    // other side of the switch are left as they are.
    void renderLibrary();
  });

  $('btn-import').addEventListener('click', () => void runImport());
  $<HTMLInputElement>('import-url').addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') void runImport();
  });
  document.querySelectorAll<HTMLButtonElement>('button[data-demo-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const demo = DEMO_CHARTS[Number(btn.dataset.demoIndex)];
      if (demo) $<HTMLInputElement>('import-url').value = demo.link;
    });
  });

  $<HTMLInputElement>('import-backup-file').addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    // The input is reset by runBackupImport once the file has been read,
    // not here: clearing it while a read is still pending detaches the
    // file the browser handed us, and on a phone that read then fails with
    // an error carrying no message, which looks like nothing happening.
    if (file) void runBackupImport(file, input);
  });

  $('btn-chart-back').addEventListener('click', () => navigate({ view: 'library' }));
  $('btn-level-prev').addEventListener('click', () => {
    if (chartView && chartView.level > 1) setLevel((chartView.level - 1) as ChordLevel);
  });
  $('btn-level-next').addEventListener('click', () => {
    if (chartView && chartView.level < CHORD_LEVELS.length) {
      setLevel((chartView.level + 1) as ChordLevel);
    }
  });

  document.querySelectorAll<HTMLButtonElement>('button[data-notation]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setNotationMode(readNotationMode(btn.dataset.notation ?? null));
    });
  });

  $('btn-copy-chart').addEventListener('click', () => void copyCurrentChart());

  window.addEventListener('popstate', () => {
    void route();
  });
}

export async function boot(): Promise<void> {
  // Read before anything consults the flag, so that a persist parameter in
  // the address bar applies to this page's first render.
  applyFlagsFromUrl();
  bind();
  await route();
}
