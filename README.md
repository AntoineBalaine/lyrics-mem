# lyrics-mem

Two memorisation tools for musicians, served from one Astro site: a lyrics
memoriser and a chord chart memoriser. Both work by progressive cloze,
showing you less of the material each time through until you are playing or
singing from memory.

Everything runs in the browser. There is no account, no server-side
database and no network call once a page has loaded.

## The two apps

### Lyrics, at `/`

Paste or import a song's words, then step through four levels. The first
shows the text bionic-reading style, with the leading characters of each
word emphasised. The second strips the emphasis. The third leaves only the
first letter of every word. The fourth leaves only the first letters of
each line. By the fourth you are reciting with almost nothing in front of
you.

Lyrics can be fetched by search from LRCLIB or Musixmatch, or pasted in by
hand.

### Chord charts, at `/chords/`

Paste an iReal Pro chart link, or import an iReal Pro HTML backup to bring
a whole library in at once. A chart can then be read three ways:

- chord symbols, as written
- Nashville numbers, read against the major scale on the key's tonic, or on
  its relative major when the key is minor
- number notation, read against the major scale on the song's own tonic,
  which is what iReal Pro's own number charts do

Five cloze levels, each hiding more than the last: everything visible, then
the chord qualities hidden with the roots kept, then every second bar, then
all but the first bar of each four, then nothing at all. A hidden chord is
drawn as dashes rather than removed, so the shape of the chart stays put.

Charts are drawn as a text grid rather than engraved on a staff. A chord
chart has no pitches to engrave, and forcing one through a notation format
that wants notes was the source of a long run of defects.

The chart itself is parsed by [abcls](https://github.com/AntoineBalaine/abcls),
whose `abcls-parser` package holds a scanner and parser for iReal Pro's own
grid language.

## Storage

Each app keeps its library in this browser's IndexedDB, and nothing leaves
the machine. A chord chart stores the iRealPro link it came from and
nothing derived from it, so improving the parser improves every chart
already saved rather than only newly imported ones.

Chord persistence can be switched off with `?persist=0`, and back on with
`?persist=1`. It is there for working on the parser: with it off a reload
always starts from an empty library, so a chart read by an older build
cannot be mistaken for a fresh one. The setting sticks until it is changed
again, and charts already saved are left alone, reappearing when it is
switched back on.

## Running it

```
npm install
npm run dev            # the private build, which bakes in the tracked songs
npm run dev:public     # the public build, which ships no songs
npm test
npm run lint
```

`abcls-parser` is a `file:` dependency pointing at a sibling checkout of
the abcls repository. It can also be taken from a release tarball, which
needs no registry:

```
"abcls-parser": "https://github.com/AntoineBalaine/abcls/releases/download/v0.1.14/abcls-parser-0.1.14.tgz"
```

## The two builds

One codebase, one environment variable, two sites.

| | private | public |
| --- | --- | --- |
| built by | `npm run build` | `npm run build:public` |
| output | `dist/` | `dist-public/` |
| lyrics | the repository's own songs, rendered at build time | none shipped; the page reads your own browser's library |

`compose.yaml` serves each build from a container, and a systemd unit in
`scripts/systemd/` brings the pair up at boot.

## Licence

The code is under the GNU Lesser General Public License, version 3 or
later. `COPYING.LESSER` holds that licence and `COPYING` holds the GNU
General Public License it is built on; the LGPL needs both.

The song lyrics the private build reads from `src/content/songs/` are not
in this repository and are not covered by that licence. They are other
people's words, so they are neither the owner's to publish nor to license;
they live only on the machine that builds the private site, and
`.gitignore` keeps them out. A clone will build the public site as it
stands and the private one with an empty library.
