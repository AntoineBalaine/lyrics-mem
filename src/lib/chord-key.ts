// Slug/id generation for chord charts, mirroring src/lib/song-key.ts.

export function chordSlug(title: string, composer: string): string {
  return `${title} ${composer}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
