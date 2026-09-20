import {
  addChordChart,
  deleteChordChart,
  getChordChart,
  listChordCharts,
  type ChordChartRecord,
} from './chords-db';
import { applyChordLevel, CHORD_LEVELS, type ChordLevel } from './chord-cloze';
import { DEMO_CHARTS } from './chords-demo-seed';
import { importIrealLink } from './ireal-import';

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
}

function readUrl(): UrlState {
  const p = new URLSearchParams(location.search);
  const view = p.get('view') === 'chart' ? 'chart' : 'library';
  const id = p.get('id') ?? undefined;
  const rawLevel = parseInt(p.get('level') ?? '1', 10);
  const level = (Number.isFinite(rawLevel) ? Math.max(1, Math.min(4, rawLevel)) : 1) as ChordLevel;
  return { view, id, level };
}

function writeUrl(state: UrlState, push: boolean): void {
  const p = new URLSearchParams();
  if (state.view !== 'library') p.set('view', state.view);
  if (state.id) p.set('id', state.id);
  if (state.view === 'chart' && state.level && state.level !== 1) {
    p.set('level', String(state.level));
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

// ─────────────────────────────────────────────────────────────
// Chart view (level switcher, abcjs render)
// ─────────────────────────────────────────────────────────────

interface ChartViewState {
  chart: ChordChartRecord;
  level: ChordLevel;
}
let chartView: ChartViewState | null = null;

function renderAtCurrentLevel(): void {
  if (!chartView) return;
  const { chart, level } = chartView;
  $('chart-level-num').textContent = String(level);
  const abc = applyChordLevel(level, chart.abc);
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
  const prevBtn = $<HTMLButtonElement>('btn-level-prev');
  const nextBtn = $<HTMLButtonElement>('btn-level-next');
  prevBtn.disabled = level <= 1;
  nextBtn.disabled = level >= CHORD_LEVELS.length;

  // Debug output: the exact ABC text fed to abcjs for this level, and the
  // ABCx text it was originally converted from, so the conversion
  // pipeline can be inspected without opening devtools.
  $('debug-abc-output').textContent = abc;
  $('debug-abcx-output').textContent = chart.abcx ?? '(no ABCx saved for this chart — imported before this field existed)';
}

async function renderChart(id: string, level: ChordLevel): Promise<void> {
  const chart = await getChordChart(id);
  if (!chart) {
    navigate({ view: 'library' });
    return;
  }
  chartView = { chart, level };
  $('chart-title').textContent = `${chart.title} — ${chart.composer}`;
  document.title = `${chart.title} - ${chart.composer}`;
  renderAtCurrentLevel();
}

function setLevel(level: ChordLevel): void {
  if (!chartView) return;
  chartView.level = level;
  renderAtCurrentLevel();
  writeUrl({ view: 'chart', id: chartView.chart.id, level }, true);
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
        await renderChart(state.id, state.level ?? 1);
      } else {
        chartView.level = state.level ?? 1;
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

  $('btn-chart-back').addEventListener('click', () => navigate({ view: 'library' }));
  $('btn-level-prev').addEventListener('click', () => {
    if (chartView && chartView.level > 1) setLevel((chartView.level - 1) as ChordLevel);
  });
  $('btn-level-next').addEventListener('click', () => {
    if (chartView && chartView.level < CHORD_LEVELS.length) {
      setLevel((chartView.level + 1) as ChordLevel);
    }
  });

  window.addEventListener('popstate', () => {
    void route();
  });
}

export async function boot(): Promise<void> {
  bind();
  await route();
}
