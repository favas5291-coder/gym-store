import { useState } from "react";

import {
  guestAccess,
  restoreGuestAccess,
} from "../utils/guestCheckout.js";

export default function GuestOrderAccess({
  backup = false,
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const access = guestAccess();

  async function copyAccessCode() {
    if (!access) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        access.token,
      );

      setMessage(
        "Private access code copied. Store it somewhere safe.",
      );
    } catch {
      setMessage(
        "Open Show access code below and copy it manually.",
      );
    }
  }

  async function restore(event) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      await restoreGuestAccess(code);

      setCode("");
      setMessage(
        "Guest order access restored.",
      );
    } catch (error) {
      setMessage(
        error.message ||
          "Access could not be restored.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="panel gd-guest-access"
      aria-label="Private guest order access"
    >
      <h2>
        {backup
          ? "Keep access to your order"
          : "Guest orders"}
      </h2>

      {access ? (
        <>
          <p>
            Your private access is saved{" "}
            {access.persistent === false
              ? "for this tab"
              : "in this browser"}
            {" until "}
            {new Date(
              access.expiresAt,
            ).toLocaleDateString("en-IN")}
            . Save a copy before closing this tab,
            clearing browser data or switching devices.
          </p>

          <button
            className="button secondary"
            type="button"
            onClick={copyAccessCode}
          >
            Copy private access code
          </button>

          <details>
            <summary>
              Show access code
            </summary>

            <p>
              Anyone with this code can access your
              guest orders. Keep it private.
            </p>

            <code
              style={{
                overflowWrap: "anywhere",
                display: "block",
              }}
            >
              {access.token}
            </code>
          </details>
        </>
      ) : (
        <p>
          Already ordered as a guest? Restore access
          using the private code you saved after checkout.
        </p>
      )}

      <details>
        <summary>
          Restore guest orders on this browser
        </summary>

        <form
          onSubmit={restore}
          aria-busy={busy}
        >
          <label>
            Private guest access code

            <input
              type="text"
              name="guest-access-code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
              }}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={68}
              required
              disabled={busy}
            />
          </label>

          <button
            type="submit"
            className="button secondary"
            disabled={busy}
          >
            {busy
              ? "Checking…"
              : "Restore order access"}
          </button>
        </form>
      </details>

      {message && (
        <p role="status">
          {message}
        </p>
      )}
    </section>
  );
}