export interface SongMeta {
  artist: string;
  title: string;
}

export function parseSongFilename(filename: string): SongMeta {
  const stem = filename.replace(/\.txt$/i, '');
  const idx = stem.indexOf(' - ');
  if (idx === -1) {
    throw new Error(`Filename must follow "Artist - Title.txt" — got: ${filename}`);
  }
  return {
    artist: stem.slice(0, idx).trim(),
    title: stem.slice(idx + 3).trim(),
  };
}

export function songSlug(artist: string, title: string): string {
  return `${artist} ${title}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
