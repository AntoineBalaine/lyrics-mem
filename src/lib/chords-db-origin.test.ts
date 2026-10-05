// A file of its own, because the case needs an origin with no chart
// database yet and vitest gives each test file its own fake-indexeddb.
// Folded into chords-db.test.ts it would run after that file's own writes
// had already created the store, which is precisely the state it exists to
// rule out.
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { addChordChart, listChordCharts } from './chords-db';
import { setPersistenceEnabled } from './feature-flags';

describe('an unrelated database already on the origin', () => {
  it('creates the store even when one of this name exists at the same version', async () => {
    // What a real browser hit the first time a chart was saved. The host
    // and port had served other things, one of which left a database of
    // this name behind, so the store was simply absent and every read
    // failed with "not a known object store name". Opening at a fixed
    // version cannot fix that, since an upgrade runs only when the version
    // rises.
    const stale = await openDB('chords-mem', 1, {
      upgrade(connection) {
        connection.createObjectStore('somethingElse', { keyPath: 'id' });
      },
    });
    stale.close();

    setPersistenceEnabled(true);
    await addChordChart({
      title: 'All Of Me',
      composer: 'Marks',
      link: 'irealb://All Of Me=Marks== =C==1r34LbKcu7C^7 |',
    });
    expect((await listChordCharts()).map((record) => record.title)).to.deep.equal(['All Of Me']);
  });

  it('leaves whatever else the database held in place', async () => {
    const connection = await openDB('chords-mem');
    expect([...connection.objectStoreNames].sort()).to.deep.equal(['charts', 'somethingElse']);
    connection.close();
  });
});
