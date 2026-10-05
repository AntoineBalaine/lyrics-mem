import { beforeEach, describe, expect, it } from 'vitest';
import { applyFlagsFromUrl, isPersistenceEnabled, setPersistenceEnabled } from './feature-flags';

/**
 * The query parameter is the only way to change this flag now that the
 * checkbox is gone, so it is worth pinning rather than assumed.
 */
describe('applyFlagsFromUrl', () => {
  beforeEach(() => {
    setPersistenceEnabled(true);
  });

  it('turns persistence off', () => {
    applyFlagsFromUrl('?persist=0');
    expect(isPersistenceEnabled()).to.equal(false);
  });

  it('turns it back on', () => {
    applyFlagsFromUrl('?persist=0');
    applyFlagsFromUrl('?persist=1');
    expect(isPersistenceEnabled()).to.equal(true);
  });

  it('accepts false and true spelled out', () => {
    applyFlagsFromUrl('?persist=false');
    expect(isPersistenceEnabled()).to.equal(false);
    applyFlagsFromUrl('?persist=true');
    expect(isPersistenceEnabled()).to.equal(true);
  });

  it('leaves the setting alone when the parameter is absent', () => {
    setPersistenceEnabled(false);
    applyFlagsFromUrl('?view=chart&id=x');
    expect(isPersistenceEnabled()).to.equal(false);
  });

  it('keeps the setting after a navigation that drops the parameter', () => {
    // The app rebuilds the query string from scratch when it navigates, so
    // persist is not in the URL after the first page; the stored value is
    // what carries it, and that is the point of storing it.
    applyFlagsFromUrl('?persist=0');
    applyFlagsFromUrl('');
    expect(isPersistenceEnabled()).to.equal(false);
  });

  it('is on by default', () => {
    // Keeping a library is what the app is for; losing it is the exception.
    applyFlagsFromUrl('?persist=1');
    expect(isPersistenceEnabled()).to.equal(true);
  });
});
