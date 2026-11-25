import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import useEditorRecovery from "./useEditorRecovery.jsx";

// Callers supply only editable tracking or customer-message fields.
// Approval, refund and cash-collection confirmations stay in the live form.
export default function useFulfilmentDraft({ entity, revision, fields, original, labels, restore }) {
  const { user, token } = useAuth();
  const [older, setOlder] = useState(null);
  const identity = JSON.stringify([user?.id || user?._id, user?.role, entity]);
  const changed = Object.fromEntries(Object.entries(fields).filter(([key, value]) => value !== original[key]));
  const recovery = useEditorRecovery({
    user, token, entity, value: { revision, changed }, dirty: Object.keys(changed).length > 0,
    restore(saved) {
      const allowed = Object.fromEntries(Object.entries(saved.changed || {}).filter(
        ([name, value]) => Object.hasOwn(labels, name) && typeof value === "string",
      ));
      if (saved.revision !== revision) {
        setOlder({ identity, fields: allowed });
      } else {
        setOlder(null);
        restore(allowed);
      }
    },
  });
  const olderFields = older?.identity === identity ? older.fields : null;
  return {
    clear: recovery.clear,
    notice: <>{recovery.notice}{olderFields && <div className="notice" role="status">
      This record changed after the draft was saved. Review these earlier entries alongside the current record.
      <dl>{Object.entries(olderFields).filter(([name]) => Object.hasOwn(labels,name)).map(([name,value]) =>
        <div key={name}><dt>{labels[name]}</dt><dd>{String(value || "Cleared")}</dd></div>)}</dl>
      <button type="button" className="text-link" onClick={() => {
        if (window.confirm("Discard these earlier entries?")) {
          void recovery.clear().then(() => setOlder(null)).catch(() => {});
        }
      }}>Discard earlier entries</button>
    </div>}</>,
  };
}
