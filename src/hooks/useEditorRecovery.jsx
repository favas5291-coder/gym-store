import { guestDraftKey } from "../utils/guestCheckout.js";
import { useLayoutEffect, useRef, useState } from "react";
import { getEditorDraftKey } from "../services/authApi.js";
import { openEditorJournal } from "../utils/editorJournal.js";

export default function useEditorRecovery({ user, token, entity, value, dirty, restore, onPersist, guest = false, autoResume = false, commitOnInput = false }) {
  const owner = user?.id || user?._id;
  const scope = entity && (owner ? JSON.stringify([owner, user.role, ...entity]) : guest ? JSON.stringify(["guest", ...entity]) : null);
  const current = useRef(null);
  const latest = useRef(null);
  const [state, setState] = useState({});
  const [attempt, setAttempt] = useState(0);

  useLayoutEffect(() => {
    setState({});
    if (!scope || (!token && !guest)) return;
    const session = { journal: null, pending: null, timer: null, blocked: false, live: true, lastValue: null, lastEncoded: undefined, writes: 0 };
    current.current = session;
    const show = data => { if (session.live) setState(data); };
    session.onPersist = onPersist;
    session.write = async (snapshot, message) => {
      const sequence = ++session.writes;
      clearTimeout(session.timer);
      session.pending = null;
      if (!session.journal || session.blocked) throw new Error("Wait for draft recovery before continuing.");
      try {
        await session.journal.write(snapshot);
        if (snapshot !== null) session.onPersist?.();
        if (!session.pending && session.writes === sequence) show({ message });
      } catch (error) {
        session.blocked = true;
        show({ error: error.message || "Draft could not be saved on this device." });
        throw error;
      }
    };
    session.flush = () => {
      if (session.pending !== null && session.journal && !session.blocked) {
        session.saving = true;
        void session.write(session.pending, "Draft saved on this device.").catch(() => {}).finally(() => {
          session.saving = false;
          if (commitOnInput && session.pending) session.flush();
        });
      }
    };
    session.queue = () => {
      if (!session.journal || session.blocked) return;
      const input = latest.current;
      if (!input.dirty) {
        clearTimeout(session.timer);
        session.pending = null;
        session.lastValue = null;
        session.lastEncoded = undefined;
        return;
      }
      if (session.lastValue === input.value) return;
      session.lastValue = input.value;
      const encoded = JSON.stringify(input.value);
      if (encoded === session.lastEncoded) return;
      session.lastEncoded = encoded;
      clearTimeout(session.timer);
      session.pending = input.value;
      show({ message: "Saving draft…" });
      // A browser may terminate asynchronous pagehide work. For short,
      // frequently interrupted forms begin the encrypted write in this turn.
      // Coalesce overlapping keystrokes while disk I/O is still outstanding.
      if (commitOnInput) {
        if (!session.saving) queueMicrotask(session.flush);
      } else {
        session.timer = setTimeout(session.flush, 250);
      }
    };
    const access = guest ? guestDraftKey() : getEditorDraftKey(token);
    session.ready = access.then(data => openEditorJournal(
      guest ? JSON.stringify(["guest", data.owner, ...entity]) : scope, data.key,
    )).then(journal => {
      if (!session.live) {
        // A route change can beat key acquisition on the first edit.
        if (session.detached && journal.value === null) return journal.write(session.detached);
        return;
      }
      session.journal = journal;
      if (journal.value !== null && latest.current.autoResume && !latest.current.dirty) {
        latest.current.restore(journal.value);
        show({ message: "Saved delivery details restored." });
      } else if (journal.value !== null) {
        session.blocked = true;
        show({ recovered: journal.value });
      } else {
        session.queue();
      }
    }).catch(() => show({ error: "Draft recovery is unavailable. Your entries are still on screen." }));
    const hidden = () => { if (document.hidden) session.flush(); };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", session.flush);
    window.addEventListener("online", session.flush);
    return () => {
      session.live = false;
      if (!session.journal && latest.current?.dirty) session.detached = latest.current.value;
      session.flush();
      current.current = null;
      clearTimeout(session.timer);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", session.flush);
      window.removeEventListener("online", session.flush);
    };
  }, [scope, token, attempt, guest, commitOnInput]);

  useLayoutEffect(() => {
    latest.current = { value, dirty, restore, autoResume };
    current.current?.queue();
  }, [scope, value, dirty]);

  async function clear() {
    const session = current.current;
    if (!session) return;
    if (!session.journal) await session.ready;
    if (!session.journal) throw new Error("Unable to clear the draft on this device.");
    session.blocked = false;
    await session.write(null, "");
  }

  function resume() {
    if (!current.current || !state.recovered) return;
    if (dirty && !window.confirm("Replace your current edits with the saved draft?")) return;
    current.current.blocked = false;
    restore(state.recovered);
    setState({ message: "Draft restored." });
  }

  const notice = state.recovered ? <div className="notice" role="status">
    A saved draft is available. <button type="button" className="text-link" onClick={resume}>Resume draft</button>{" "}
    <button type="button" className="text-link" onClick={() => {
      if (window.confirm("Discard the saved draft?")) void clear().then(() => current.current?.queue()).catch(() => {});
    }}>Discard saved draft</button>
  </div> : state.error ? <p className="field-error" role="status">{state.error} <button type="button" onClick={() => setAttempt(n => n + 1)}>Retry draft recovery</button></p>
    : state.message ? <p className="muted" role="status">{state.message}</p> : null;

  return { notice, hasRecovery: Boolean(state.recovered), clear, checkpoint: async snapshot => {
    const session = current.current;
    if (!session) throw new Error("Draft recovery is unavailable.");
    if (!session.journal) await session.ready;
    await session.write(snapshot, "Draft saved on this device.");
  } };
}
