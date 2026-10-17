import { useId } from "react";

const fields = [
  ["fullName", "Full name", "name", "text"],
  ["email", "Email", "email", "email"],
  ["phone", "Mobile number", "tel-national", "tel"],
  [
    "addressLine",
    "House number, building and street",
    "street-address",
    "text",
  ],
  [
    "landmark",
    "Landmark (optional)",
    "address-line2",
    "text",
  ],
  ["city", "City", "address-level2", "text"],
  ["state", "State", "address-level1", "text"],
  ["pincode", "Pincode", "postal-code", "text"],
];

const maximumLengths = {
  fullName: 100,
  email: 150,
  phone: 16,
  addressLine: 200,
  landmark: 150,
  city: 100,
  state: 100,
  pincode: 6,
};

function fieldValue(name, input) {
  if (
    name !== "phone" &&
    name !== "pincode"
  ) {
    return input;
  }

  const digits = input.replace(/\D/g, "");

  // Accept an Indian number pasted or autofilled with +91.
  // Store the delivery number in its ten-digit form.
  if (
    name === "phone" &&
    digits.length === 12 &&
    digits.startsWith("91")
  ) {
    return digits.slice(2);
  }

  return digits;
}

export default function AddressForm({
  value = {},
  onChange,
  errors = {},
}) {
  const prefix = useId();

  return (
    <div className="address-form">
      {fields.map(
        ([name, label, autoComplete, type]) => {
          const id = `${prefix}-${name}`;
          const error = errors[name];

          const inputMode =
            name === "pincode"
              ? "numeric"
              : name === "phone"
                ? "tel"
                : name === "email"
                  ? "email"
                  : undefined;

          return (
            <div
              className={
                `field field-${name}` +
                (
                  name === "addressLine"
                    ? " field-wide"
                    : ""
                )
              }
              key={name}
            >
              <label htmlFor={id}>
                {label}
              </label>

              <input
                id={id}
                name={name}
                type={type}
                value={String(
                  value?.[name] ?? "",
                )}
                autoComplete={autoComplete}
                autoCapitalize={
                  name === "email"
                    ? "none"
                    : undefined
                }
                autoCorrect={
                  name === "email"
                    ? "off"
                    : undefined
                }
                required={name !== "landmark"}
                maxLength={maximumLengths[name]}
                inputMode={inputMode}
                aria-invalid={Boolean(error)}
                aria-describedby={
                  error
                    ? `${id}-error`
                    : undefined
                }
                onChange={(event) => {
                  onChange({
                    ...value,

                    [name]: fieldValue(
                      name,
                      event.target.value,
                    ),
                  });
                }}
              />

              {error && (
                <p
                  id={`${id}-error`}
                  className="field-error"
                >
                  {error}
                </p>
              )}
            </div>
          );
        },
      )}
    </div>
  );
}