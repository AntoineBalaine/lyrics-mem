import MiniSearch from 'minisearch';
import { searchLrclib } from './adapters/lrclib';
import {
  addSong,
  deleteSong,
  exportLibrary,
  getSong,
  importLibrary,
  listSongs,
  songRecordSchema,
  updateSong,
  type SongRecord,
} from './db';
import { demoSongs } from './demo-seed';
import { applyStep, HTML_STEPS, STEPS, type Step } from './transformations';

type View = 'library' | 'song' | 'add' | 'manual' | 'edit';

interface UrlState {
  view: View;
  id?: string;
  step?: Step;
}

const VIEWS: View[] = ['library', 'song', 'add', 'manual', 'edit'];

function readUrl(): UrlState {
  const p = new URLSearchParams(location.search);
  const view = p.get('view') as View | null;
  const id = p.get('id') ?? undefined;
  const stepRaw = parseInt(p.get('step') ?? '1', 10);
  const step = (Number.isFinite(stepRaw) ? Math.max(1, Math.min(4, stepRaw)) : 1) as Step;
  return {
    view: view && VIEWS.includes(view) ? view : 'library',
    id,
    step,
  };
}

function writeUrl(state: UrlState, push: boolean): void {
  const p = new URLSearchParams();
  if (state.view !== 'library') p.set('view', state.view);
  if (state.id) p.set('id', state.id);
  if (state.view === 'song' && state.step && state.step !== 1) {
    p.set('step', String(state.step));
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

function showView(view: View): void {
  for (const v of VIEWS) {
    const el = document.getElementById(`view-${v}`);
    if (el) el.hidden = v !== view;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function ensureSeeded(): Promise<void> {
  const existing = await listSongs();
  if (existing.length === 0) {
    for (const s of demoSongs) await addSong(s);
  }
}

// ─────────────────────────────────────────────────────────────
// Library view
// ─────────────────────────────────────────────────────────────

let libraryFilter = '';

async function renderLibrary(): Promise<void> {
  const songs = await listSongs();
  // Newest at the top.
  songs.sort((a, b) => b.savedAt - a.savedAt);

  const list = $<HTMLUListElement>('library-list');
  const empty = $('library-empty');
  const filterInput = $<HTMLInputElement>('library-filter');

  filterInput.value = libraryFilter;

  let filtered = songs;
  if (libraryFilter.trim()) {
    const ms = new MiniSearch<{ id: string; text: string }>({
      fields: ['text'],
      storeFields: ['id'],
      searchOptions: { fuzzy: 0.2, prefix: true },
    });
    ms.addAll(songs.map((s) => ({ id: s.id, text: `${s.artist} ${s.title}` })));
    const hits = new Set(ms.search(libraryFilter).map((r) => r.id as string));
    filtered = songs.filter((s) => hits.has(s.id));
  }

  list.innerHTML = filtered
    .map(
      (s) => `
      <li>
        <a href="?view=song&id=${encodeURIComponent(s.id)}" data-id="${escapeHtml(s.id)}" class="library-item">
          <span class="lib-title">${escapeHtml(s.title)}</span>
          <span class="lib-artist">${escapeHtml(s.artist)}</span>
        </a>
      </li>`,
    )
    .join('');

  empty.hidden = songs.length > 0;
  $('library-count').textContent = `${songs.length} song${songs.length === 1 ? '' : 's'}`;

  // Intercept clicks for SPA nav
  list.querySelectorAll<HTMLAnchorElement>('a.library-item').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.dataset.id!;
      navigate({ view: 'song', id, step: 1 });
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Song view (step switcher)
// ─────────────────────────────────────────────────────────────

interface SongViewState {
  song: SongRecord;
  step: Step;
}
let songView: SongViewState | null = null;

function renderSongStep(): void {
  if (!songView) return;
  const { step } = songView;
  document.documentElement.dataset.activeStep = String(step);
  $('song-step-num').textContent = String(step);
  const fabPrev = $<HTMLAnchorElement>('song-fab-prev');
  const fabNext = $<HTMLAnchorElement>('song-fab-next');
  fabPrev.hidden = step <= 1;
  fabNext.hidden = step >= 4;
}

async function renderSong(id: string, step: Step): Promise<void> {
  const song = await getSong(id);
  if (!song) {
    navigate({ view: 'library' });
    return;
  }
  songView = { song, step };
  $('song-title').textContent = `${song.artist} — ${song.title}`;
  document.title = `${song.artist} - ${song.title}`;

  // Render all 4 step fragments.
  const container = $<HTMLDivElement>('song-steps');
  container.innerHTML = STEPS.map((s) => {
    const html = applyStep(s, song.body);
    if (HTML_STEPS.has(s)) {
      return `<pre data-step="${s}">${html}</pre>`;
    }
    return `<pre data-step="${s}">${escapeHtml(html)}</pre>`;
  }).join('');

  renderSongStep();
}

function setStep(step: Step): void {
  if (!songView) return;
  songView.step = step;
  renderSongStep();
  writeUrl({ view: 'song', id: songView.song.id, step }, true);
}

// ─────────────────────────────────────────────────────────────
// Add (LRCLIB search)
// ─────────────────────────────────────────────────────────────

async function runRemoteSearch(): Promise<void> {
  const q = $<HTMLInputElement>('add-query').value.trim();
  const status = $('add-status');
  const results = $<HTMLUListElement>('add-results');
  if (!q) {
    status.textContent = '';
    results.innerHTML = '';
    return;
  }

  status.textContent = 'Searching…';
  results.innerHTML = '';
  try {
    const hits = await searchLrclib(q);
    const withLyrics = hits.filter((h) => h.plainLyrics);
    if (withLyrics.length === 0) {
      status.textContent = `No results with lyrics. ${hits.length > 0 ? 'Some matches were instrumentals.' : ''}`;
      return;
    }
    status.textContent = `${withLyrics.length} match${withLyrics.length === 1 ? '' : 'es'}`;
    results.innerHTML = withLyrics
      .map(
        (t, i) => `
        <li>
          <button data-i="${i}" class="add-pick">
            <span class="lib-title">${escapeHtml(t.trackName)}</span>
            <span class="lib-artist">${escapeHtml(t.artistName)}${t.albumName ? ' · ' + escapeHtml(t.albumName) : ''}</span>
          </button>
        </li>`,
      )
      .join('');

    results.querySelectorAll<HTMLButtonElement>('button.add-pick').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const i = parseInt(btn.dataset.i ?? '0', 10);
        const t = withLyrics[i];
        if (!t.plainLyrics) return;
        const saved = await addSong({
          artist: t.artistName,
          title: t.trackName,
          body: t.plainLyrics,
          source: 'lrclib',
        });
        navigate({ view: 'song', id: saved.id, step: 1 });
      });
    });
  } catch (err) {
    status.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ─────────────────────────────────────────────────────────────
// Manual add
// ─────────────────────────────────────────────────────────────

async function saveManual(): Promise<void> {
  const artist = $<HTMLInputElement>('manual-artist').value.trim();
  const title = $<HTMLInputElement>('manual-title').value.trim();
  const body = $<HTMLTextAreaElement>('manual-body').value;
  if (!artist || !title || !body.trim()) {
    $('manual-status').textContent = 'Artist, title, and lyrics are all required.';
    return;
  }
  const saved = await addSong({ artist, title, body, source: 'manual' });
  navigate({ view: 'song', id: saved.id, step: 1 });
}

// ─────────────────────────────────────────────────────────────
// Edit
// ─────────────────────────────────────────────────────────────

let editingId: string | null = null;

async function loadEdit(id: string): Promise<void> {
  const song = await getSong(id);
  if (!song) {
    navigate({ view: 'library' });
    return;
  }
  editingId = id;
  $<HTMLInputElement>('edit-artist').value = song.artist;
  $<HTMLInputElement>('edit-title').value = song.title;
  $<HTMLTextAreaElement>('edit-body').value = song.body;
  $('edit-status').textContent = '';
}

async function saveEdit(): Promise<void> {
  if (!editingId) return;
  const artist = $<HTMLInputElement>('edit-artist').value.trim();
  const title = $<HTMLInputElement>('edit-title').value.trim();
  const body = $<HTMLTextAreaElement>('edit-body').value;
  if (!artist || !title || !body.trim()) {
    $('edit-status').textContent = 'Artist, title, and lyrics are all required.';
    return;
  }
  const updated = await updateSong(editingId, { artist, title, body });
  navigate({ view: 'song', id: updated.id, step: 1 });
}

async function confirmDelete(): Promise<void> {
  if (!editingId) return;
  if (!confirm('Delete this song?')) return;
  await deleteSong(editingId);
  editingId = null;
  navigate({ view: 'library' });
}

// ─────────────────────────────────────────────────────────────
// Export / import
// ─────────────────────────────────────────────────────────────

async function downloadLibrary(): Promise<void> {
  const dump = await exportLibrary();
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `lyrics-mem-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function uploadLibrary(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const mode = confirm('Replace your current library?\nOK = replace, Cancel = merge')
        ? 'replace'
        : 'merge';
      const count = await importLibrary(data, mode);
      alert(`Imported ${count} song${count === 1 ? '' : 's'} (${mode}).`);
      void route();
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
  input.click();
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
    case 'song':
      if (!state.id) {
        navigate({ view: 'library' });
        return;
      }
      if (!songView || songView.song.id !== state.id) {
        await renderSong(state.id, state.step ?? 1);
      } else {
        songView.step = state.step ?? 1;
        renderSongStep();
      }
      break;
    case 'add':
      $<HTMLInputElement>('add-query').value = '';
      $('add-status').textContent = '';
      $<HTMLUListElement>('add-results').innerHTML = '';
      break;
    case 'manual':
      $<HTMLInputElement>('manual-artist').value = '';
      $<HTMLInputElement>('manual-title').value = '';
      $<HTMLTextAreaElement>('manual-body').value = '';
      $('manual-status').textContent = '';
      break;
    case 'edit':
      if (!state.id) {
        navigate({ view: 'library' });
        return;
      }
      await loadEdit(state.id);
      break;
  }
}

function bind(): void {
  // Library
  $<HTMLInputElement>('library-filter').addEventListener('input', (e) => {
    libraryFilter = (e.target as HTMLInputElement).value;
    void renderLibrary();
  });
  $('btn-add-search').addEventListener('click', () => navigate({ view: 'add' }));
  $('btn-add-manual').addEventListener('click', () => navigate({ view: 'manual' }));
  $('btn-export').addEventListener('click', () => void downloadLibrary());
  $('btn-import').addEventListener('click', () => uploadLibrary());

  // Add (LRCLIB search)
  $<HTMLInputElement>('add-query').addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') void runRemoteSearch();
  });
  $('btn-add-go').addEventListener('click', () => void runRemoteSearch());
  $('btn-add-back').addEventListener('click', () => navigate({ view: 'library' }));
  $('btn-add-manual-from-search').addEventListener('click', () => navigate({ view: 'manual' }));

  // Manual
  $('btn-manual-save').addEventListener('click', () => void saveManual());
  $('btn-manual-cancel').addEventListener('click', () => navigate({ view: 'library' }));

  // Edit
  $('btn-edit-save').addEventListener('click', () => void saveEdit());
  $('btn-edit-delete').addEventListener('click', () => void confirmDelete());
  $('btn-edit-cancel').addEventListener('click', () =>
    navigate({ view: 'song', id: editingId ?? undefined, step: 1 }),
  );

  // Song view
  $('btn-song-back').addEventListener('click', () => navigate({ view: 'library' }));
  $('btn-song-edit').addEventListener('click', () => {
    if (songView) navigate({ view: 'edit', id: songView.song.id });
  });
  $<HTMLAnchorElement>('song-fab-prev').addEventListener('click', (e) => {
    e.preventDefault();
    if (songView && songView.step > 1) setStep((songView.step - 1) as Step);
  });
  $<HTMLAnchorElement>('song-fab-next').addEventListener('click', (e) => {
    e.preventDefault();
    if (songView && songView.step < 4) setStep((songView.step + 1) as Step);
  });

  // Swipe with direction lock — same pattern as the per-slug page
  let startX = 0;
  let startY = 0;
  let valid = false;
  let lockedHorizontal = false;
  let lockedVertical = false;
  const LOCK_THRESHOLD = 10;
  const SWIPE_MIN = 60;
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) {
        valid = false;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      valid = true;
      lockedHorizontal = false;
      lockedVertical = false;
    },
    { passive: true },
  );
  document.addEventListener(
    'touchmove',
    (e) => {
      if (!valid || readUrl().view !== 'song') return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!lockedHorizontal && !lockedVertical) {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX > LOCK_THRESHOLD || absY > LOCK_THRESHOLD) {
          if (absX > absY) lockedHorizontal = true;
          else lockedVertical = true;
        }
      }
      if (lockedHorizontal) e.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener(
    'touchend',
    (e) => {
      if (!valid || !lockedHorizontal || readUrl().view !== 'song' || !songView) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      if (Math.abs(dx) < SWIPE_MIN) return;
      if (dx < 0 && songView.step < 4) setStep((songView.step + 1) as Step);
      else if (dx > 0 && songView.step > 1) setStep((songView.step - 1) as Step);
    },
    { passive: true },
  );

  window.addEventListener('popstate', () => {
    void route();
  });
}

export async function boot(): Promise<void> {
  bind();
  await ensureSeeded();
  // Ignore the unused-import lint warning by referencing the schema once.
  void songRecordSchema;
  await route();
}
