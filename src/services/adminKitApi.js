const API_URL = String(
  import.meta.env.VITE_API_URL || "http://localhost:5000/api",
)
  .trim()
  .replace(/\/+$/, "");

async function request(
  token,
  path,
  { method = "GET", body, signal } = {},
) {
  if (!token) {
    throw new Error("Please sign in as an admin.");
  }

  let response;

  try {
    response = await fetch(`${API_URL}/kits${path}`, {
      method,
      signal,
      cache: "no-store",

      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },

      body: body !== undefined
        ? JSON.stringify(body)
        : undefined,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    throw new Error(
      method === "GET"
        ? "Cannot connect to the kit service."
        : "The save result is unknown. Reload the kits before trying again.",
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.success !== true) {
    const error = new Error(
      data?.message ||
        "The kit service returned an unreadable response. Reload before saving again.",
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

export async function getAdminKits(token, options) {
  const data = await request(token, "/admin", options);

  if (!Array.isArray(data.kits)) {
    throw new Error("The kit list could not be read.");
  }

  return data.kits;
}

export async function createKitDrafts(token, options) {
  const data = await request(
    token,
    "/admin/defaults",
    {
      ...options,
      method: "POST",
    },
  );

  if (!Array.isArray(data.kits)) {
    throw new Error(
      "Reload to check whether the drafts were created.",
    );
  }

  return data.kits;
}

export async function saveKitDraft(token, kit, options) {
  if (kit.status !== "draft") {
    throw new Error(
      "Only drafts can be edited on this screen.",
    );
  }

  const body = {
    version: kit.version,
    name: kit.name,
    audience: kit.audience,
    explanation: kit.explanation,
    status: "draft",

    slots: kit.slots.map((row) => ({
      key: row.key,
      role: row.role,
      label: row.label,
      whySelected: row.whySelected,
      optional: row.optional,
      suggestedEssential: row.suggestedEssential,
      defaultIncluded: row.defaultIncluded,
      defaultProduct: row.defaultProduct,
      defaultSize: row.defaultSize,
      defaultColor: row.defaultColor,
      defaultQuantity: row.defaultQuantity,
      maximumQuantity: row.maximumQuantity,
      allowedProducts: row.allowedProducts,
    })),

    fulfillment: {
      mode: kit.fulfillment?.mode || "unconfigured",

      packingLocation:
        kit.fulfillment?.mode === "packed-together"
          ? kit.fulfillment.packingLocation || null
          : null,

      customerNote:
        kit.fulfillment?.customerNote || "",
    },

    discount: {
      type: kit.discount.type,
      value: kit.discount.value,
      minimumSubtotal: kit.discount.minimumSubtotal,
      minimumCategories: kit.discount.minimumCategories,
      requiredRoles: kit.discount.requiredRoles,
      allowCouponStacking:
        kit.discount.allowCouponStacking,
    },
  };

  const data = await request(
    token,
    `/admin/${encodeURIComponent(kit.id || kit._id)}`,
    {
      ...options,
      method: "PUT",
      body,
    },
  );

  if (!data.kit) {
    throw new Error(
      "Reload to check whether your changes were saved.",
    );
  }

  return data.kit;
}