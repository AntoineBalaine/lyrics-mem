/**
 * Runtime switches the user can flip without a rebuild.
 *
 * Persistence is the one that exists, and it is a switch rather than a
 * constant because the two ways this app gets used want opposite answers.
 * Playing from the library wants charts to survive a reload. Working on the
 * conversion pipeline wants them not to: a persisted chart converted by an
 * older build looks exactly like a fresh one, so every manual test has to
 * begin by deleting and re-importing to be sure of what is on screen. That
 * is why storage was unhooked in the first place.
 */

const PERSIST_KEY = 'chords-mem:persist';

/**
 * The value in force for this page.
 *
 * Held here as well as in storage so that setting a flag holds even where
 * storage cannot be written: a browser set to block site data, a private
 * window, or any context with no localStorage at all. Without this the
 * setter would appear to succeed and the getter would keep returning the
 * default, which is a worse failure than not persisting the choice.
 * `undefined` means it has not been read yet.
 */
let persistInForce: boolean | undefined;

/**
 * Reads a stored flag, treating any failure as absent.
 *
 * Reading localStorage throws rather than returning null in a browser set
 * to block site data, and a private window may have none of it at all, so
 * a failure here must leave the app working rather than stop it.
 */
function readStoredFlag(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredFlag(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A browser that will not store the choice still honours it for this
    // page, since the caller re-reads through this module.
  }
}

/**
 * Takes a `persist` query parameter as the new setting, if one is present.
 *
 * The parameter writes the stored value rather than overriding it for one
 * page, so that `?persist=0` is a durable switch rather than something to
 * repeat on every navigation.
 */
export function applyFlagsFromUrl(search: string = location.search): void {
  const value = new URLSearchParams(search).get('persist');
  if (value === null) return;
  setPersistenceEnabled(value !== '0' && value !== 'false');
}

/** Whether charts are kept in the browser between reloads. */
export function isPersistenceEnabled(): boolean {
  if (persistInForce === undefined) {
    // On by default: keeping a library is what the app is for, and losing
    // it is the deliberate exception.
    persistInForce = readStoredFlag(PERSIST_KEY) !== '0';
  }
  return persistInForce;
}

export function setPersistenceEnabled(enabled: boolean): void {
  persistInForce = enabled;
  writeStoredFlag(PERSIST_KEY, enabled ? '1' : '0');
}
