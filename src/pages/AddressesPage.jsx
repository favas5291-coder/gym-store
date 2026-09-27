import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import {
  addressErrors,
  EMPTY_ADDRESS,
  getAddresses,
  saveAddresses,
} from "../utils/customerData.js";
import { makeId } from "../utils/storage.js";
import AccountLayout from "../components/AccountLayout.jsx";
import AddressForm from "../components/AddressForm.jsx";
import Modal from "../components/Modal.jsx";
export default function AddressesPage() {
  const { user } = useAuth(),
    { notify } = useStore();
  const [addresses, setAddresses] = useState(() => getAddresses(user)),
    [editing, setEditing] = useState(null),
    [errors, setErrors] = useState({}),
    [error, setError] = useState("");
  function commit(next) {
    if (!saveAddresses(user, next)) {
      setError("Could not save addresses. Check browser storage.");
      return false;
    }
    setAddresses(next);
    setError("");
    return true;
  }
  function save(event) {
    event.preventDefault();
    const invalid = addressErrors(editing);
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    const item = {
      ...editing,
      id: editing.id || makeId("address"),
      isDefault: editing.isDefault || !addresses.length,
    };
    const rest = addresses
      .filter((a) => a.id !== item.id)
      .map((a) => (item.isDefault ? { ...a, isDefault: false } : a));
    if (commit([...rest, item])) {
      setEditing(null);
      notify("Address saved.");
    }
  }
  function remove(id) {
    const remaining = addresses.filter((a) => a.id !== id);
    if (remaining.length && !remaining.some((a) => a.isDefault))
      remaining[0] = { ...remaining[0], isDefault: true };
    if (commit(remaining)) notify("Address removed.", "info");
  }
  return (
    <AccountLayout title="Saved addresses">
      <button
        type="button"
        className="button secondary"
        onClick={() => {
          setEditing({
            ...EMPTY_ADDRESS,
            fullName: user.name,
            email: user.email,
            phone: user.phone || "",
          });
          setErrors({});
          setError("");
        }}
      >
        + Add new address
      </button>
      {error && !editing && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="address-list">
        {addresses.map((a) => (
          <article className="address-card" key={a.id}>
            <strong>{a.fullName}</strong>
            {a.isDefault && <span className="status-pill">Default</span>}
            <p>
              {a.addressLine}
              <br />
              {a.city}, {a.state} – {a.pincode}
            </p>
            <p>{a.phone}</p>
            <div className="action-links">
              <button
                type="button"
                onClick={() => {
                  setEditing({ ...a });
                  setErrors({});
                  setError("");
                }}
              >
                Edit
              </button>
              <button type="button" onClick={() => remove(a.id)}>
                Remove
              </button>
              {!a.isDefault && (
                <button
                  type="button"
                  onClick={() =>
                    commit(
                      addresses.map((x) => ({
                        ...x,
                        isDefault: x.id === a.id,
                      })),
                    )
                  }
                >
                  Make default
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!addresses.length && (
        <p className="muted">Add an address for faster checkout.</p>
      )}
      {editing && (
        <Modal
          title={editing.id ? "Edit address" : "Add address"}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save} noValidate>
            <AddressForm
              value={editing}
              onChange={setEditing}
              errors={errors}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={Boolean(editing.isDefault)}
                onChange={(e) =>
                  setEditing({ ...editing, isDefault: e.target.checked })
                }
              />
              Make this my default address
            </label>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <button className="button full" type="submit">
              Save address
            </button>
          </form>
        </Modal>
      )}
    </AccountLayout>
  );
}