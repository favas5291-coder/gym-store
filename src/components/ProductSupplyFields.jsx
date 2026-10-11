import { Link } from "react-router-dom";
import { KIT_ROLES } from "../utils/adminProductDraft.js";

function Field({ label, help, children }) {
  return (
    <label className="ap-field">
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}

const STOCK_NAMES = {
  unconfirmed: "Not confirmed",
  gymdrobe: "GymDrobe-held stock",
  supplier: "Supplier-held stock",
};

const DISPATCH_NAMES = {
  unconfirmed: "Not confirmed",
  gymdrobe: "GymDrobe",
  supplier: "Supplier",
  "fulfillment-partner": "Fulfillment partner",
};

const RETURN_NAMES = {
  unconfirmed: "Not confirmed",
  yes: "Eligible under the recorded conditions",
  no: "Not eligible",
};

export function SupplyFields({ draft, setDraft, options }) {
  const selected = options.suppliers?.find(
    (row) => row.id === draft.supplier,
  );

  const missingSupplier = draft.supplier && !selected;

  function change(key, value) {
    setDraft((current) => ({
      ...current,
      [key]: value,
      confirmSupplierStock: false,
      ...(["supplier", "stockSource"].includes(key)
        ? { supplierStockConfirmedAt: "" }
        : {}),
    }));
  }

  const confirmationDate = new Date(draft.supplierStockConfirmedAt);
  const canConfirm =
    selected?.available && draft.stockSource === "supplier";

  return (
    <section className="ap-section" id="ap-supply">
      <h3>2. Supplier and fulfillment</h3>

      <p className="ap-help">
        Record who supplies, holds and dispatches this product.
        Brand and supplier are separate.{" "}
        <Link to="/admin/suppliers">Manage suppliers</Link>.
      </p>

      <fieldset
        className="ap-form-fields"
        disabled={!options.ready}
      >
        <legend className="sr-only">
          Supplier and fulfillment settings
        </legend>

        <div className="ap-grid">
          <Field
            label="Supplier"
            help="Keep unconfirmed supplier products as drafts."
          >
            <select
              value={draft.supplier}
              onChange={(event) =>
                change("supplier", event.target.value)
              }
            >
              <option value="">No supplier linked</option>

              {missingSupplier && (
                <option value={draft.supplier}>
                  Linked supplier unavailable · {draft.supplier}
                </option>
              )}

              {(options.suppliers || []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {row.supplierCode || row.status}
                  {!row.available ? " · unavailable" : ""}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Purchase cost per unit (₹)"
            help="Admin only. Leave blank when unknown. This cost alone does not establish profit."
          >
            <input
              type="number"
              min="0"
              max="100000000"
              step="0.01"
              inputMode="decimal"
              value={draft.purchaseCost}
              placeholder="Not recorded"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  purchaseCost: event.target.value,
                }))
              }
            />
          </Field>

          <Field label="Who holds the stock?">
            <select
              value={draft.stockSource}
              onChange={(event) =>
                change("stockSource", event.target.value)
              }
            >
              {(options.stockSources || [draft.stockSource]).map(
                (value) => (
                  <option key={value} value={value}>
                    {STOCK_NAMES[value] || value}
                  </option>
                ),
              )}
            </select>
          </Field>

          <Field label="Who dispatches the product?">
            <select
              value={draft.dispatchBy}
              onChange={(event) =>
                change("dispatchBy", event.target.value)
              }
            >
              {(options.dispatchMethods || [draft.dispatchBy]).map(
                (value) => (
                  <option key={value} value={value}>
                    {DISPATCH_NAMES[value] || value}
                  </option>
                ),
              )}
            </select>
          </Field>

          {["Min", "Max"].map((suffix, index) => (
            <Field
              key={suffix}
              label={
                (index ? "Maximum" : "Minimum") +
                " preparation days"
              }
              help="Time needed before dispatch. Enter both limits, or leave both unknown."
            >
              <input
                type="number"
                min="0"
                max="365"
                step="1"
                inputMode="numeric"
                value={draft["preparationDays" + suffix]}
                placeholder="Not recorded"
                onChange={(event) =>
                  change(
                    "preparationDays" + suffix,
                    event.target.value,
                  )
                }
              />
            </Field>
          ))}
        </div>

        {selected && !selected.available && (
          <p className="notice">
            {selected.unavailableReason ||
              "This supplier cannot publish products yet."}
          </p>
        )}

        {missingSupplier && (
          <p className="notice">
            The saved supplier was not returned. Its link is
            preserved; choose an available supplier before publishing.
          </p>
        )}

        <label className="ap-check">
          <input
            type="checkbox"
            checked={draft.canSendToPackingLocation}
            onChange={(event) =>
              change(
                "canSendToPackingLocation",
                event.target.checked,
              )
            }
          />
          This supplier can send this product to our packing location
        </label>

        <p className="ap-help">
          This records a capability. Kit packing locations, readiness
          and shipment tracking will be configured in the kit
          management stage.
        </p>

        {draft.stockSource === "supplier" && (
          <>
            <p className="ap-help">
              Last recorded stock check:{" "}
              {draft.supplierStockConfirmedAt &&
              !Number.isNaN(confirmationDate.getTime())
                ? confirmationDate.toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })
                : "Not recorded"}
              .
            </p>

            <label className="ap-check">
              <input
                type="checkbox"
                checked={draft.confirmSupplierStock}
                disabled={!canConfirm}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    confirmSupplierStock: event.target.checked,
                  }))
                }
              />
              I checked these quantities with the supplier; record
              a fresh stock confirmation when saving
            </label>

            {!canConfirm && (
              <p className="ap-help">
                Choose an available, verified supplier to record
                a stock confirmation.
              </p>
            )}
          </>
        )}
      </fieldset>

      {!options.ready && (
        <p className="notice">
          Supplier settings are locked until the updated dropdown
          options load. Existing values are preserved.
        </p>
      )}
    </section>
  );
}

export function KitFields({ draft, setDraft, options }) {
  function toggle(role, checked) {
    setDraft((current) => ({
      ...current,
      kitRoles: checked
        ? [...new Set([...current.kitRoles, role])]
        : current.kitRoles.filter((value) => value !== role),
    }));
  }

  return (
    <section className="ap-section" id="ap-kit">
      <h3>7. Fitness Kit eligibility</h3>

      <p className="ap-help">
        Choose the kit categories this product can serve.
        Eligibility makes it a candidate for configured templates;
        it does not publish a kit.
      </p>

      <fieldset
        className="ap-form-fields"
        disabled={!options.ready}
      >
        <legend className="sr-only">
          Fitness Kit product eligibility
        </legend>

        <label className="ap-check">
          <input
            type="checkbox"
            checked={draft.kitEligible}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                kitEligible: event.target.checked,
              }))
            }
          />
          Allow this product in Fitness Kit templates
        </label>

        <div className="ap-grid">
          {(options.kitRoles || draft.kitRoles).map((role) => (
            <label className="ap-check" key={role}>
              <input
                type="checkbox"
                checked={draft.kitRoles.includes(role)}
                onChange={(event) =>
                  toggle(role, event.target.checked)
                }
              />
              {KIT_ROLES[role] || role}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="ap-help">
        Supplements will remain optional, with a “No supplements”
        choice. Training level alone does not determine supplement
        needs.
      </p>

      <p className="notice">
        Drafts and unavailable variants must be excluded when
        configuring a purchasable kit. Kit templates, discounts and
        the customer builder are still to be added.
      </p>
    </section>
  );
}

export function VariantLabelFields({ draft, setDraft, options }) {
  return (
    <fieldset
      className="ap-form-fields"
      disabled={!options.ready}
    >
      <legend className="sr-only">Variant labels</legend>

      <div className="ap-grid">
        {[
          ["sizeLabel", "First option label", "sizeOptionLabels"],
          ["colorLabel", "Second option label", "colorOptionLabels"],
        ].map(([key, label, values]) => (
          <Field
            key={key}
            label={label}
            help="Changing the label preserves existing quantities and variant SKUs."
          >
            <select
              value={draft[key]}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
            >
              {(options[values] || [draft[key]]).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
        ))}
      </div>

      <p className="ap-help">
        Use the existing two option groups for pairs such as
        Size/Colour or Pack size/Flavour. Enter supplier-confirmed
        values below.
      </p>
    </fieldset>
  );
}

export function DeliveryPolicyFields({
  draft,
  setDraft,
  options,
}) {
  function change(key, value) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <fieldset
      className="ap-form-fields"
      disabled={!options.ready}
    >
      <legend className="sr-only">
        Delivery timing and return eligibility
      </legend>

      <div className="ap-grid" style={{ marginTop: 20 }}>
        {["Min", "Max"].map((suffix, index) => (
          <Field
            key={suffix}
            label={
              (index ? "Maximum" : "Minimum") +
              " courier transit days"
            }
            help="Time after dispatch. Leave both limits blank if unknown."
          >
            <input
              type="number"
              min="0"
              max="365"
              step="1"
              inputMode="numeric"
              placeholder="Not recorded"
              value={draft["transitDays" + suffix]}
              onChange={(event) =>
                change("transitDays" + suffix, event.target.value)
              }
            />
          </Field>
        ))}

        <Field label="Return eligibility">
          <select
            value={draft.returnsEligible}
            onChange={(event) =>
              change("returnsEligible", event.target.value)
            }
          >
            {(
              options.returnEligibility || [draft.returnsEligible]
            ).map((value) => (
              <option key={value} value={value}>
                {RETURN_NAMES[value] || value}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Return window after delivery (days)"
          help="The existing return flow supports 1–7 days. Unconfirmed eligibility is not a return promise."
        >
          <input
            type="number"
            required
            min={options.returnWindow?.minimumDays || 1}
            max={options.returnWindow?.maximumDays || 7}
            step="1"
            inputMode="numeric"
            value={draft.returnWindowDays}
            onChange={(event) =>
              change("returnWindowDays", event.target.value)
            }
          />
        </Field>

        <Field
          label="Product-specific return conditions"
          help="Record exclusions and actual conditions, especially for supplements and hygiene items."
        >
          <textarea
            rows={3}
            maxLength={2000}
            value={draft.returnConditions}
            onChange={(event) =>
              change("returnConditions", event.target.value)
            }
          />
        </Field>
      </div>
    </fieldset>
  );
}