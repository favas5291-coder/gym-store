// ======================================================
// READ LOCAL STORAGE
// ======================================================

export function readStorage(
  key,
  fallback
) {
  try {
    const value =
      localStorage.getItem(
        key
      );

    return value === null
      ? fallback
      : JSON.parse(
          value
        );

  } catch {
    return fallback;
  }
}


// ======================================================
// WRITE LOCAL STORAGE
// ======================================================

export function writeStorage(
  key,
  value
) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(
        value
      )
    );

    return true;

  } catch {
    return false;
  }
}


// ======================================================
// REMOVE LOCAL STORAGE
// ======================================================

export function removeStorage(
  key
) {
  try {
    localStorage.removeItem(
      key
    );

    return true;

  } catch {
    return false;
  }
}


// ======================================================
// USER-SPECIFIC STORAGE KEY
// ======================================================

export function userKey(
  base,
  user
) {
  return `${base}:${String(
    user?.id ||
      user?.email ||
      "guest"
  ).toLowerCase()}`;
}


// ======================================================
// UNIQUE ID
// ======================================================

export function makeId(
  prefix = "GD"
) {
  return `${prefix}-${crypto.randomUUID()}`;
}


// ======================================================
// SAFE REDIRECT PATH
// ======================================================

export function safeNext(
  value
) {
  return (
    typeof value ===
      "string" &&

    value.startsWith(
      "/"
    ) &&

    !value.startsWith(
      "//"
    ) &&

    !/^\/(login|signup)([/?#]|$)/.test(
      value
    ) &&

    !value.includes(
      "\\"
    )
  )
    ? value
    : "/account";
}