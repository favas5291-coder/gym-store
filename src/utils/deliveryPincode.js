export const validPincode = (value) =>
  /^[1-9]\d{5}$/.test(String(value || "").trim());

const memory = new Map();

export function savedPincode(key) {
  if (memory.has(key)) return memory.get(key);

  for (const name of ["localStorage", "sessionStorage"]) {
    try {
      const value = JSON.parse(
        globalThis[name].getItem(key) || "null",
      );

      if (validPincode(value)) {
        return String(value).trim();
      }
    } catch {
      // Browser storage can be unavailable.
    }
  }

  return "";
}

// Keep an older saved address until a customer
// explicitly saves a new pincode.
export function pincodeForCheckout(key, addressPincode = "") {
  const saved = savedPincode(key);

  let explicitlySaved =
    memory.has(key) && validPincode(saved);

  for (const name of ["localStorage", "sessionStorage"]) {
    try {
      explicitlySaved ||=
        JSON.parse(
          globalThis[name].getItem(`${key}:selected`) || "null",
        ) === saved;
    } catch {
      // Try the other store.
    }
  }

  if (saved && explicitlySaved) {
    return saved;
  }

  if (validPincode(addressPincode)) {
    return String(addressPincode).trim();
  }

  return saved;
}

export function savePincode(key, input) {
  const value = String(input || "").trim();

  if (!validPincode(value)) {
    throw new Error(
      "Enter a valid six-digit Indian pincode.",
    );
  }

  memory.set(key, value);

  let persisted = false;

  for (const name of ["localStorage", "sessionStorage"]) {
    try {
      globalThis[name].setItem(
        key,
        JSON.stringify(value),
      );

      globalThis[name].setItem(
        `${key}:selected`,
        JSON.stringify(value),
      );

      persisted = true;
    } catch {
      // Keep a usable memory copy.
    }
  }

  globalThis.dispatchEvent?.(
    new CustomEvent("gymdrobe-delivery-changed", {
      detail: {
        key,
        pincode: value,
      },
    }),
  );

  return persisted;
}

export function clearPincode(key) {
  memory.set(key, "");

  for (const name of ["localStorage", "sessionStorage"]) {
    try {
      globalThis[name].removeItem(key);
      globalThis[name].removeItem(`${key}:selected`);
    } catch {
      // Browser storage can be unavailable.
    }
  }

  globalThis.dispatchEvent?.(
    new CustomEvent("gymdrobe-delivery-changed", {
      detail: {
        key,
        pincode: "",
      },
    }),
  );
}