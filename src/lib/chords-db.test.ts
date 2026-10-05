// Use fake-indexeddb so the persistent backend can be exercised in node,
// the same way db.test.ts does for the lyrics store.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addChordChart,
  addChordCharts,
  clearChordCharts,
  deleteChordChart,
  getChordChart,
  listChordCharts,
} from './chords-db';
import { isPersistenceEnabled, setPersistenceEnabled } from './feature-flags';

function chart(title: string, composer = 'Composer') {
  return { title, composer, link: `irealb://${title}=${composer}== =C==1r34LbKcu7C^7 |` };
}

/**
 * Both backends are exercised by the same cases, because the point of the
 * flag is that the library behaves the same either way; only its lifetime
 * differs. Each run clears whichever library the flag currently selects.
 */
for (const persistent of [true, false]) {
  describe(`the chart library, persistence ${persistent ? 'on' : 'off'}`, () => {
    beforeEach(async () => {
      setPersistenceEnabled(persistent);
      await clearChordCharts();
    });

    it("reports the flag it was given", () => {
      expect(isPersistenceEnabled()).to.equal(persistent);
    });

    it("adds a chart and reads it back", async () => {
      const saved = await addChordChart(chart('Autumn Leaves', 'Kosma'));
      expect(await getChordChart(saved.id)).to.deep.equal(saved);
    });

    it("lists charts oldest first, which is what the library sorts from", async () => {
      await addChordCharts([chart('A'), chart('B'), chart('C')]);
      const titles = (await listChordCharts()).map((record) => record.title);
      expect(titles.sort()).to.deep.equal(['A', 'B', 'C']);
    });

    it("overwrites a chart with the same title and composer", async () => {
      // A re-imported backup must not grow duplicates.
      await addChordChart(chart('Blue Bossa', 'Dorham'));
      await addChordChart(chart('Blue Bossa', 'Dorham'));
      expect((await listChordCharts()).length).to.equal(1);
    });

    it("treats a different composer as a different chart", async () => {
      await addChordChart(chart('Solar', 'Davis'));
      await addChordChart(chart('Solar', 'Someone Else'));
      expect((await listChordCharts()).length).to.equal(2);
    });

    it("deletes one chart and leaves the rest", async () => {
      const [first] = await addChordCharts([chart('A'), chart('B')]);
      await deleteChordChart(first.id);
      expect((await listChordCharts()).map((record) => record.title)).to.deep.equal(['B']);
    });

    it("adds many charts at once", async () => {
      const many = Array.from({ length: 50 }, (_, i) => chart(`Tune ${i}`));
      await addChordCharts(many);
      expect((await listChordCharts()).length).to.equal(50);
    });

    it("stores the link and nothing derived from it", async () => {
      const saved = await addChordChart(chart('Test'));
      expect(Object.keys(saved).sort()).to.deep.equal(
        ['composer', 'id', 'link', 'savedAt', 'source', 'title'].sort(),
      );
    });
  });
}

describe('switching the flag', () => {
  it('leaves the charts on the other side alone', async () => {
    // Turning persistence off must not destroy a kept library, and turning
    // it back on must show it again; that is what makes the flag safe to
    // use during a manual test.
    setPersistenceEnabled(true);
    await clearChordCharts();
    await addChordChart(chart('Kept'));

    setPersistenceEnabled(false);
    await clearChordCharts();
    await addChordChart(chart('Temporary'));
    expect((await listChordCharts()).map((r) => r.title)).to.deep.equal(['Temporary']);

    setPersistenceEnabled(true);
    expect((await listChordCharts()).map((r) => r.title)).to.deep.equal(['Kept']);
  });
});
