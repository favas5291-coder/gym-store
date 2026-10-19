export const RETURN_REQUEST_TYPES = Object.freeze([
  "return",
  "exchange",
]);

export function validReturnRequestTypes(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 2 &&
    new Set(value).size === value.length &&
    value.every((type) =>
      RETURN_REQUEST_TYPES.includes(type),
    )
  );
}

export function returnRequestTypes(
  item,
  { historical = false } = {},
) {
  if (
    item?.returnRequestTypes == null &&
    historical
  ) {
    return [...RETURN_REQUEST_TYPES];
  }

  return validReturnRequestTypes(
    item?.returnRequestTypes,
  )
    ? [...item.returnRequestTypes]
    : [];
}

export function returnPolicyMarkup(
  product,
  productUrl,
) {
  if (
    !["yes", "no"].includes(
      product?.returnsEligible,
    )
  ) {
    return null;
  }

  const types = returnRequestTypes(product);

  // Legacy text can describe an exchange-only offer.
  // Record supported actions explicitly before
  // publishing a return promise to Google.
  if (
    product.returnsEligible === "yes" &&
    !types.length
  ) {
    return null;
  }

  const hasRecordedConditions = [
    product.returnPolicy,
    product.returnConditions,
  ].some(
    (value) =>
      typeof value === "string" &&
      value.trim(),
  );

  if (
    product.returnsEligible === "yes" &&
    !hasRecordedConditions
  ) {
    return null;
  }

  const accepted =
    product.returnsEligible === "yes" &&
    types.includes("return");

  const days = product.returnWindowDays;

  if (
    accepted &&
    (
      !Number.isSafeInteger(days) ||
      days < 1 ||
      days > 7
    )
  ) {
    return null;
  }

  return {
    "@type": "MerchantReturnPolicy",

    applicableCountry: "IN",

    returnPolicyCategory: accepted
      ? "https://schema.org/MerchantReturnFiniteReturnWindow"
      : "https://schema.org/MerchantReturnNotPermitted",

    ...(accepted
      ? { merchantReturnDays: days }
      : {}),

    merchantReturnLink:
      `${productUrl}#delivery-returns`,
  };
}