import { pendingShopping, acknowledgeShopping, appendShopping, initializeShoppingJournal, captureShoppingJournal, markShoppingReviewed } from "./shoppingJournal.js";

export function createShoppingSync({ user, api, publish, status = () => {}, storage, snapshot, now = Date.now }) {
  let active = true, running = false, requested = false, paused = false, generation = 0;
  const options = { storage, now };
  const pending = () => pendingShopping(user, options);
  const readState = data => {
    const state = data?.state;
    if (!state || state.version !== 1 || !Number.isSafeInteger(state.revision) || state.revision < 0 ||
        !Array.isArray(state.cart) || !Array.isArray(state.wishlist)) throw new Error("Saved shopping information could not be read.");
    return state;
  };
  const report = value => { if (active) status(value); };
  async function flush() {
    if (!active || paused) return;
    if (running) { requested = true; return; }
    running = true;
    const currentGeneration = generation;
    try {
      do {
        requested = false;
        initializeShoppingJournal(user, options);
        report("syncing");
        let current = readState(await api.read());
        if (!active || paused || currentGeneration !== generation) return;
        for (const entry of pending()) {
          if (!pending().some(value => value.id === entry.id)) continue;
          let confirmed = false;
          for (let attempt = 0; attempt < 4; attempt++) {
            try {
              const result = await api.mutate({ id: entry.id, issuedAt: entry.issuedAt, changes: entry.changes,
                baseRevision: entry.reviewRevision ?? current.revision });
              if (!active || paused || currentGeneration !== generation) return;
              current = readState(result);
              acknowledgeShopping(user, entry, options);
              confirmed = true;
              break;
            } catch (error) {
              if (!active || paused || currentGeneration !== generation) return;
              if (!pending().some(value => value.id === entry.id)) { confirmed = true; break; }
              if (error.code !== "SHOPPING_REVISION_CONFLICT" || entry.changes.some(change => change.type === "replace")) throw error;
              current = readState(error.data);
            }
          }
          if (!confirmed) { report("waiting"); return; }
        }
        if (!active || paused || currentGeneration !== generation) return;
        // New edits are journaled before local state changes. Never replace them
        // with an older server snapshot while an acknowledgement is pending.
        if (pending().length) requested = true;
        else { publish(current); report("saved"); }
      } while (requested && active && !paused);
    } catch (error) {
      if (!active || currentGeneration !== generation) return;
      requested = false;
      if (["SHOPPING_REVIEW_REQUIRED", "SHOPPING_OPERATION_CONFLICT", "SHOPPING_LIMIT_REACHED", "SHOPPING_REVISION_CONFLICT", "SHOPPING_INPUT_INVALID"].includes(error.code) || error.message?.includes("review")) {
        paused = true; report("review");
      } else if (error.status === 401 || error.status === 403) { paused = true; report("sign-in"); }
      else if (error.code === "SHOPPING_SYNC_UNAVAILABLE") { report("unavailable"); }
      else if (!error.status && error.message?.includes("storage")) { paused = true; report("storage"); }
      else report("offline");
    } finally {
      running = false;
      if (requested && active && !paused) queueMicrotask(() => { void flush(); });
    }
  }
  return {
    flush,
    pause() { paused = true; report("storage"); },
    dispose() { active = false; },
    async useAccount() {
      generation++; paused = true;
      const old = captureShoppingJournal(user, options);
      const current = readState(await api.read());
      if (!active) return;
      appendShopping(user, [{ type: "replace", selection: { cart: current.cart, wishlist: current.wishlist }, confirmed: true }], {
        ...options, supersedes: old.map(entry => entry.id), reviewRevision: current.revision,
      });
      markShoppingReviewed(user, options);
      paused = false;
      await flush();
    },
    async keepDevice() {
      generation++; paused = true;
      const old = captureShoppingJournal(user, options);
      appendShopping(user, [{ type: "replace", selection: snapshot(), confirmed: true }], {
        ...options, supersedes: old.map(entry => entry.id),
      });
      markShoppingReviewed(user, options);
      paused = false;
      await flush();
    },
  };
}
