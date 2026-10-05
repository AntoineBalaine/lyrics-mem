// A file of its own for the same reason as chords-db-origin.test.ts: the
// case needs an origin whose chart database is at a version this code
// would never have picked, and vitest gives each file a fresh
// fake-indexeddb. Sharing a file with another storage case would leave the
// database already open at a version that setup cannot raise.
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { addChordChart, listChordCharts } from './chords-db';
import { setPersistenceEnabled } from './feature-flags';

describe('a chart database left at a higher version', () => {
  it('opens it rather than asking for a lower version', async () => {
    // The second failure a real browser hit, and it was caused by the
    // repair for the first: that repair raised the version to add the
    // store, and the next page load asked for version one again. Asking
    // below the stored version does not merely skip the upgrade, it throws
    // "the stored database is a higher version than the version requested"
    // before any check can run.
    const raised = await openDB('chords-mem', 7, {
      upgrade(connection) {
        const store = connection.createObjectStore('charts', { keyPath: 'id' });
        store.createIndex('by-savedAt', 'savedAt');
      },
    });
    raised.close();

    setPersistenceEnabled(true);
    await addChordChart({
      title: 'Blue Bossa',
      composer: 'Dorham',
      link: 'irealb://Blue Bossa=Dorham== =C==1r34LbKcu7C^7 |',
    });
    expect((await listChordCharts()).map((record) => record.title)).to.deep.equal(['Blue Bossa']);
  });

  it('leaves the version where it found it, having nothing to add', async () => {
    const connection = await openDB('chords-mem');
    expect(connection.version).to.equal(7);
    connection.close();
  });
});
