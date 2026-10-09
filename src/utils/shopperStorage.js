import {
  readStorage,
  writeStorage,
  removeStorage,
  userKey,
} from "./storage.js";

import {
  getCartItemKey,
} from "./cartUtils.js";

// ======================================================
// ACCOUNT STORAGE KEYS
// ======================================================

// Keep existing guest and account keys compatible.
export const shoppingKey = (base, user) =>
  user ? userKey(base, user) : base;

export const SHOPPING_KEYS = Object.freeze([
  "gymdrobe-cart",
  "gymdrobe-wishlist",
  "gymdrobe-coupon",
  "gymdrobe-saved-for-later",
  "gymdrobe-compare",
  "gymdrobe-product-watches",
  "gymdrobe-recently-viewed",
  "gymdrobe-delivery-pincode",
]);

const ARRAY_KEYS = new Set([
  "gymdrobe-cart",
  "gymdrobe-wishlist",
  "gymdrobe-saved-for-later",
  "gymdrobe-compare",
  "gymdrobe-product-watches",
  "gymdrobe-recently-viewed",
]);

// ======================================================
// HELPERS
// ======================================================

function isObject(value) {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function idOf(value) {
  const id = isObject(value)
    ? [
        value.id,
        value._id,
        value.legacyId,
      ].find(
        (candidate) =>
          ["string", "number"].includes(
            typeof candidate,
          ) &&
          String(candidate).trim(),
      )
    : value;

  if (
    !["string", "number"].includes(typeof id) ||
    !String(id).trim()
  ) {
    throw new Error(
      "A saved shopping item has an invalid product reference.",
    );
  }

  return String(id);
}

function quantityOf(value) {
  if (
    !["number", "string"].includes(
      typeof value,
    ) ||
    (typeof value === "string" && !value.trim())
  ) {
    throw new Error(
      "A saved bag item has an invalid quantity.",
    );
  }

  const quantity = Number(value);

  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  ) {
    throw new Error(
      "A saved bag item has an invalid quantity.",
    );
  }

  return quantity;
}

function fingerprint(value) {
  const serialized = JSON.stringify(value);

  if (typeof serialized !== "string") {
    throw new Error(
      "Shopping information could not be saved.",
    );
  }

  return serialized;
}

// ======================================================
// MERGE BAG / SAVED-FOR-LATER ROWS
// ======================================================

function mergeRows(account, guest) {
  const rows = new Map();

  for (const item of [...account, ...guest]) {
    if (!isObject(item)) {
      throw new Error(
        "A saved bag item could not be read.",
      );
    }

    const normalized = {
      ...item,

      id: idOf(item),

      quantity: quantityOf(item.quantity),

      selectedSize:
        item.selectedSize == null ||
        item.selectedSize === ""
          ? null
          : String(item.selectedSize),

      selectedColor:
        item.selectedColor == null ||
        item.selectedColor === ""
          ? null
          : String(item.selectedColor),
    };

    const key = getCartItemKey(normalized);
    const previous = rows.get(key);

    const quantity =
      (previous?.quantity || 0) +
      normalized.quantity;

    if (!Number.isSafeInteger(quantity)) {
      throw new Error(
        "A combined bag quantity is too large.",
      );
    }

    rows.set(key, {
      ...(previous || normalized),
      quantity,
    });
  }

  // Current catalogue prices and stock are checked
  // separately by revalidateCart.
  return [...rows.values()];
}

// ======================================================
// MERGE WISHLIST / COMPARE / WATCHES / RECENT ITEMS
// ======================================================

function mergeLists(base, account, guest) {
  // Guest browsing happened most recently.
  const source =
    base === "gymdrobe-recently-viewed"
      ? [...guest, ...account]
      : [...account, ...guest];

  const items = new Map();

  for (const item of source) {
    const id = idOf(item);

    if (
      base === "gymdrobe-product-watches" &&
      !isObject(item)
    ) {
      throw new Error(
        "A saved product watch could not be read.",
      );
    }

    if (!items.has(id)) {
      items.set(
        id,
        base === "gymdrobe-product-watches"
          ? { ...item, id }
          : id,
      );
    }
  }

  const result = [...items.values()];

  if (base === "gymdrobe-compare") {
    return result.slice(0, 4);
  }

  if (base === "gymdrobe-recently-viewed") {
    return result.slice(0, 8);
  }

  return result;
}

// ======================================================
// CHOOSE MERGED VALUE
// ======================================================

function mergedValue(base, account, guest) {
  // Preserve an existing account coupon or pincode.
  if (!ARRAY_KEYS.has(base)) {
    return account ?? guest;
  }

  if (
    !Array.isArray(guest) ||
    (account != null && !Array.isArray(account))
  ) {
    throw new Error(
      "A saved shopping list could not be read. Both copies were kept.",
    );
  }

  const existing = account ?? [];

  if (
    base === "gymdrobe-cart" ||
    base === "gymdrobe-saved-for-later"
  ) {
    return mergeRows(existing, guest);
  }

  return mergeLists(base, existing, guest);
}

// ======================================================
// TRANSFER ONE GUEST STORAGE KEY
// ======================================================

function transfer(base, target, guest) {
  // The receipt belongs to the guest list and records
  // which account is receiving it.
  const receiptKey =
    `${base}::guest-transfer-v1`;

  const guestFingerprint = fingerprint(guest);

  let account = readStorage(target, null);
  let accountFingerprint = fingerprint(account);

  let receipt = readStorage(receiptKey, null);

  if (
    receipt?.phase === "complete" &&
    receipt.version === 1
  ) {
    receipt = null;
  }

  if (receipt != null) {
    if (
      !isObject(receipt) ||
      receipt.version !== 1 ||
      !["prepared", "saved"].includes(
        receipt.phase,
      ) ||
      typeof receipt.before !== "string" ||
      typeof receipt.after !== "string"
    ) {
      throw new Error(
        "An earlier shopping transfer needs review. Both copies were kept.",
      );
    }

    if (receipt.target !== target) {
      throw new Error(
        "This guest list has an unfinished transfer to another account. It was kept for review.",
      );
    }

    if (
      receipt.guest !== guestFingerprint
    ) {
      throw new Error(
        "The guest list changed during an earlier transfer. Both copies were kept for review.",
      );
    }
  }

  if (!receipt) {
    const value = mergedValue(
      base,
      account,
      guest,
    );

    receipt = {
      version: 1,
      phase: "prepared",
      target,
      guest: guestFingerprint,
      before: accountFingerprint,
      after: fingerprint(value),
    };

    // Save the transfer plan before changing account data.
    if (!writeStorage(receiptKey, receipt)) {
      throw new Error(
        "The transfer could not be prepared. Your guest list was kept.",
      );
    }
  }

  const alreadySaved =
    receipt.phase === "saved" ||
    accountFingerprint === receipt.after;

  if (!alreadySaved) {
    if (
      accountFingerprint !== receipt.before
    ) {
      throw new Error(
        "The account list changed during transfer. Both copies were kept for review.",
      );
    }

    const value = mergedValue(
      base,
      account,
      guest,
    );

    if (
      fingerprint(value) !== receipt.after
    ) {
      throw new Error(
        "The previous transfer needs review. Both copies were kept.",
      );
    }

    // Check that neither copy changed while preparing.
    const currentGuest = readStorage(base, null);
    const currentAccount = readStorage(
      target,
      null,
    );

    if (
      fingerprint(currentGuest) !==
        guestFingerprint ||
      fingerprint(currentAccount) !==
        accountFingerprint
    ) {
      throw new Error(
        "Shopping information changed during transfer. Please retry.",
      );
    }

    if (!writeStorage(target, value)) {
      throw new Error(
        "Your account list could not be saved. Your guest list was kept.",
      );
    }

    account = readStorage(target, null);
    accountFingerprint = fingerprint(account);

    if (
      accountFingerprint !== receipt.after
    ) {
      throw new Error(
        "The saved account list could not be confirmed. Your guest list was kept.",
      );
    }
  }

  receipt = {
    ...receipt,
    phase: "saved",
  };

  writeStorage(receiptKey, receipt);

  // Never clear a guest list that changed since transfer.
  if (
    fingerprint(readStorage(base, null)) !==
    guestFingerprint
  ) {
    throw new Error(
      "Your guest list changed. It was kept for review.",
    );
  }

  removeStorage(base);

  if (readStorage(base, null) != null) {
    throw new Error(
      "Items were transferred, but the guest copy could not be cleared. A transfer receipt was kept to prevent adding it again.",
    );
  }

  // If receipt removal fails, a completed receipt can
  // safely be replaced during a future transfer.
  writeStorage(receiptKey, {
    ...receipt,
    phase: "complete",
  });

  removeStorage(receiptKey);
}

// ======================================================
// IMPORT AFTER SUCCESSFUL AUTHENTICATION
// ======================================================

export function importGuestShopping(user) {
  const report = {
    imported: [],
    pending: [],
  };

  if (!user) {
    return report;
  }

  for (const base of SHOPPING_KEYS) {
    const guest = readStorage(base, null);

    if (guest == null) {
      continue;
    }

    try {
      const target = shoppingKey(base, user);

      if (
        typeof target !== "string" ||
        !target ||
        target === base
      ) {
        throw new Error(
          "An account-specific storage key is required. Your guest list was kept.",
        );
      }

      transfer(base, target, guest);

      report.imported.push(base);
    } catch (error) {
      report.pending.push({
        key: base,
        message:
          error?.message ||
          "Your guest shopping information was kept. Please retry.",
      });
    }
  }

  return report;
}

// ======================================================
// SESSION STORAGE
// ======================================================

export function readSession(key, fallback) {
  try {
    const saved = sessionStorage.getItem(key);

    return saved == null
      ? fallback
      : JSON.parse(saved) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeSession(key, value) {
  try {
    const serialized = JSON.stringify(value);

    if (typeof serialized !== "string") {
      return false;
    }

    sessionStorage.setItem(key, serialized);

    return true;
  } catch {
    return false;
  }
}