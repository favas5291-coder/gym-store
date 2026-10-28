import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { getProductById } from "../services/productApi.js";

import { buyingInformation } from "../utils/productInformation.js";

import {
  savedPincode,
  savePincode,
  validPincode,
} from "../utils/deliveryPincode.js";

import "./DeliveryPincode.css";

export default function DeliveryPincode({
  product,
  storageKey,
}) {
  const id = useId();

  const [pincode, setPincode] = useState(() =>
    savedPincode(storageKey),
  );

  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const [message, setMessage] = useState(() => {
    const saved = savedPincode(storageKey);

    return saved
      ? `Saved pincode: ${saved}. Edit the field to change it.`
      : "";
  });

  const [review, setReview] = useState(null);

  const request = useRef(null);
  const lock = useRef(false);

  const information = buyingInformation(
    review || product,
  );

  useEffect(() => {
    return () => {
      request.current?.abort();
    };
  }, []);

  async function save(event) {
    event.preventDefault();
    event.stopPropagation();

    if (lock.current) return;

    const code = pincode.trim();

    if (!validPincode(code)) {
      setInvalid(true);

      setMessage(
        "Enter a valid six-digit Indian pincode, such as 673001.",
      );

      return;
    }

    lock.current = true;

    setInvalid(false);
    setBusy(true);

    const controller = new AbortController();

    request.current = controller;

    const persistent = savePincode(
      storageKey,
      code,
    );

    const saved = persistent
      ? `Pincode ${code} saved.`
      : `Pincode ${code} kept for this visit; browser storage is unavailable.`;

    setMessage(
      `${saved} Checking the latest delivery information…`,
    );

    try {
      const latest = await getProductById(
        product.id || product._id,
        {
          signal: controller.signal,
          timeoutMs: 12000,
        },
      );

      if (controller.signal.aborted) return;

      setReview(latest);
      setPincode(code);

      const unavailable =
        latest.delivery?.available === false ||
        latest.isActive === false;

      setMessage(
        `${saved} ${
          unavailable
            ? "This product is currently listed as unavailable for delivery."
            : "This product is listed as available for delivery."
        }`,
      );
    } catch {
      if (!controller.signal.aborted) {
        setMessage(
          `${saved} Delivery information could not be refreshed. Retry this check before buying.`,
        );
      }
    } finally {
      lock.current = false;

      if (!controller.signal.aborted) {
        setBusy(false);
      }
    }
  }

  return (
    <section
      className="delivery-pincode"
      aria-label="Delivery pincode"
    >
      <p className="muted">
        Save your pincode for checkout delivery options and charges.
      </p>

      <form
        onSubmit={save}
        noValidate
        aria-busy={busy}
      >
        <label
          className="sr-only"
          htmlFor={id}
        >
          Delivery pincode
        </label>

        <input
          id={id}
          value={pincode}
          placeholder="Enter 6-digit pincode"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          disabled={busy}
          aria-invalid={invalid}
          aria-describedby={`${id}-feedback`}
          onChange={(event) => {
            setPincode(
              event.target.value.replace(/\D/g, ""),
            );

            setInvalid(false);
            setMessage("");
          }}
        />

        <button
          className="text-link"
          type="button"
          disabled={busy}
          onClick={save}
        >
          {busy ? "Checking…" : "Save pincode"}
        </button>
      </form>

      <p
        id={`${id}-feedback`}
        className="delivery-pincode-feedback"
        role="status"
        aria-atomic="true"
      >
        {message}
      </p>

      <div className="delivery-pincode-timing">
        {information.deliveryUnavailable ? (
          <p>
            This product is currently unavailable for
            delivery. Your pincode can still be saved or
            changed.
          </p>
        ) : (
          <>
            {information.estimate && (
              <p>
                <strong>
                  Listed delivery estimate:
                </strong>{" "}
                {information.estimate} (may vary by location).
              </p>
            )}

            {information.transit && (
              <p>
                <strong>
                  Courier transit:
                </strong>{" "}
                {information.transit}. Preparation before
                dispatch is additional.
              </p>
            )}

            {!information.estimate &&
              !information.transit && (
                <p>
                  Delivery timing is not listed. Contact
                  support before buying.
                </p>
              )}
          </>
        )}

        <p className="muted">
          Product estimate only. This form does not check live courier coverage.
        </p>
      </div>
    </section>
  );
}
