import { useMemo } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import useEditorRecovery from "./useEditorRecovery.jsx";

// Keep the revision on which the editor started. Existing write endpoints
// still perform their own version checks when the operator submits.
export default function useVersionedEditorDraft({ kind, saved, value, dirty, restore, conflict, enabled = true }) {
  const { user, token } = useAuth();
  const version = saved?.version ?? saved?.revision ?? null;
  const snapshot = useMemo(() => ({ value, version }), [value, version]);
  return useEditorRecovery({
    user, token, entity: enabled ? [kind, saved?.id || saved?._id || "new"] : null,
    value: snapshot, dirty,
    restore(previous) {
      restore(previous.value);
      if (version !== previous.version) conflict();
    },
  });
}
