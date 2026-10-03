import {
  addChordChart,
  deleteChordChart,
  getChordChart,
  listChordCharts,
  type ChordChartRecord,
} from './chords-db';
import { applyChordLevel, applyChordLevelToChordGrid, CHORD_LEVELS, type ChordLevel } from './chord-cloze';
import { extractChordChartBody } from './chord-chart-text';
import { renderNumberChartHtml } from './chord-number-chart';
import { applyNotationModeToChordGrid, parseAbcKey, NOTATION_MODES, type NotationMode } from './chord-numbers';
import { DEMO_CHARTS } from './chords-demo-seed';
import { importIrealLink } from './ireal-import';
import { importLibraryBackup } from './ireal-backup-import';

declare global {
  interface Window {
    ABCJS?: {
      renderAbc: (
        el: string | HTMLElement,
        abc: string,
        params?: Record<string, unknown>,
      ) => unknown;
    };
  }
}

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
  const level = (Number.isFinite(rawLevel) ? Math.max(1, Math.min(4, rawLevel)) : 1) as ChordLevel;
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

async function renderLibrary(): Promise<void> {
  const charts = await listChordCharts();
  charts.sort((a, b) => b.savedAt - a.savedAt);

  const list = $<HTMLUListElement>('library-list');
  const empty = $('library-empty');

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

  empty.hidden = charts.length > 0;
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
    const { title, composer, abc, abcx } = importIrealLink(link);
    const saved = await addChordChart({ title, composer, abc, abcx });
    input.value = '';
    status.textContent = '';
    navigate({ view: 'chart', id: saved.id, level: 1 });
  } catch (err) {
    status.textContent = err instanceof Error ? err.message : String(err);
  }
}

// Imports every song found in an iRealPro "HTML backup" export (the
// user's whole library, bundled as a handful of multi-song playlist
// links) and adds each one to the chart library. Charts whose title and
// composer already match an existing chart overwrite it (addChordChart's
// id is derived from title+composer — see chord-key.ts's chordSlug),
// rather than growing duplicates on a re-import of the same backup.
async function runBackupImport(file: File): Promise<void> {
  const status = $('backup-import-status');
  status.textContent = 'Reading backup file…';
  try {
    const html = await file.text();
    const { charts, errors } = importLibraryBackup(html);
    status.textContent = `Importing ${charts.length} chart${charts.length === 1 ? '' : 's'}…`;
    for (const chart of charts) {
      await addChordChart(chart);
    }
    await renderLibrary();
    const parts = [`Imported ${charts.length} chart${charts.length === 1 ? '' : 's'}.`];
    if (errors.length > 0) {
      parts.push(`${errors.length} song${errors.length === 1 ? '' : 's'} could not be converted.`);
    }
    status.textContent = parts.join(' ');
  } catch (err) {
    status.textContent = err instanceof Error ? err.message : String(err);
  }
}

// ─────────────────────────────────────────────────────────────
// Chart view (level switcher, abcjs render)
// ─────────────────────────────────────────────────────────────

interface ChartViewState {
  chart: ChordChartRecord;
  level: ChordLevel;
  notation: NotationMode;
}
let chartView: ChartViewState | null = null;

function renderAtCurrentLevel(): void {
  if (!chartView) return;
  const { chart, level, notation } = chartView;
  $('chart-level-num').textContent = String(level);
  document.querySelectorAll<HTMLButtonElement>('button[data-notation]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.notation === notation));
  });
  let debugText: string;
  if (notation === 'symbols') {
    // Real chord symbols still go through abcjs for actual staff
    // notation — ABC is the right source for that, invisible-rest
    // filler and all.
    const abc = applyChordLevel(level, chart.abc);
    debugText = abc;
    if (window.ABCJS) {
      window.ABCJS.renderAbc('chart-score', abc, {
        responsive: 'resize',
        staffwidth: 700,
      });
    } else {
      // abcjs failed to load from the CDN (e.g. offline dev) — fall back to
      // showing the raw ABC text so the level-hiding logic is still visible.
      $('chart-score').innerHTML = `<pre>${escapeHtml(abc)}</pre>`;
    }
  } else {
    // Nashville/number notation skips ABC (and staff rendering) entirely
    // — there's no real pitch information to engrave, just a degree
    // chart — and works from the chart's ABCx text instead, which is
    // already a plain chord grid with no invisible-rest filler to leak
    // through. Falls back to the ABC text for charts saved before the
    // ABCx field existed.
    const source = chart.abcx ?? chart.abc;
    const key = parseAbcKey(source);
    const grid = extractChordChartBody(source);
    const converted = applyNotationModeToChordGrid(notation, key, grid);
    const clozed = applyChordLevelToChordGrid(level, converted);
    debugText = clozed;
    $('chart-score').innerHTML = renderNumberChartHtml(clozed);
  }
  const prevBtn = $<HTMLButtonElement>('btn-level-prev');
  const nextBtn = $<HTMLButtonElement>('btn-level-next');
  prevBtn.disabled = level <= 1;
  nextBtn.disabled = level >= CHORD_LEVELS.length;

  // Debug output: the exact text fed to the renderer for this level
  // (ABC for the symbol view, a plain chord grid for the number views),
  // and the ABCx text the chart was originally converted from, so the
  // conversion pipeline can be inspected without opening devtools.
  $('debug-abc-output').textContent = debugText;
  $('debug-abcx-output').textContent = chart.abcx ?? '(no ABCx saved for this chart — imported before this field existed)';
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

// Copies just the chord-chart body (bar lines with chord annotations) —
// not the X:/T:/C:/K: headers or source-link comment that precede it in
// the raw ABC text — reflecting whatever's currently on screen (cloze
// level and notation mode included).
async function copyCurrentAbc(): Promise<void> {
  const fullAbc = $('debug-abc-output').textContent ?? '';
  const abc = extractChordChartBody(fullAbc);
  if (!abc) return;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(abc);
      showCopyStatus('Copied!');
      return;
    } catch {
      // Fall through to the legacy path below.
    }
  }
  showCopyStatus(legacyCopy(abc) ? 'Copied!' : 'Copy failed — select the ABC text below manually.');
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
    input.value = ''; // allow re-selecting the same file to re-import
    if (file) void runBackupImport(file);
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

  $('btn-copy-abc').addEventListener('click', () => void copyCurrentAbc());

  window.addEventListener('popstate', () => {
    void route();
  });
}

export async function boot(): Promise<void> {
  bind();
  await route();
}
