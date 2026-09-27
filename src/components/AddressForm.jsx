import { useId } from "react";
const fields = [
  ["fullName", "Full name", "name", "text"],
  ["email", "Email", "email", "email"],
  ["phone", "Mobile number", "tel", "tel"],
  [
    "addressLine",
    "House number, building and street",
    "street-address",
    "text",
  ],
  ["landmark", "Landmark (optional)", "address-line2", "text"],
  ["city", "City", "address-level2", "text"],
  ["state", "State", "address-level1", "text"],
  ["pincode", "Pincode", "postal-code", "text"],
];
export default function AddressForm({ value, onChange, errors = {} }) {
  const prefix = useId();
  return (
    <div className="address-form">
      {fields.map(([name, label, autoComplete, type]) => (
        <div
          className={`field ${name === "addressLine" ? "field-wide" : ""}`}
          key={name}
        >
          <label htmlFor={`${prefix}-${name}`}>{label}</label>
          <input
            id={`${prefix}-${name}`}
            name={name}
            type={type}
            value={value[name] || ""}
            autoComplete={autoComplete}
            required={name !== "landmark"}
            maxLength={name === "phone" ? 10 : name === "pincode" ? 6 : 150}
            inputMode={
              name === "pincode" || name === "phone" ? "numeric" : undefined
            }
            aria-invalid={Boolean(errors[name])}
            aria-describedby={
              errors[name] ? `${prefix}-${name}-error` : undefined
            }
            onChange={(event) =>
              onChange({
                ...value,
                [name]: ["phone", "pincode"].includes(name)
                  ? event.target.value.replace(/\D/g, "")
                  : event.target.value,
              })
            }
          />
          {errors[name] && (
            <p id={`${prefix}-${name}-error`} className="field-error">
              {errors[name]}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}