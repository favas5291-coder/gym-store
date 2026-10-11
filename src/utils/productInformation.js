export function productText(value) {
  return typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function displayValue(value) {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  if (Array.isArray(value)) {
    return value.map(displayValue).filter(Boolean).join(", ");
  }

  return productText(value);
}

export function productList(value) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [value])
        .map(productText)
        .filter(Boolean),
    ),
  ];
}

export function optionLabels(product) {
  const size = productText(product?.optionLabels?.size);
  const color = productText(product?.optionLabels?.color);

  return {
    size: [
      "Size",
      "Pack size",
      "Capacity",
      "Weight",
      "Length",
      "Option",
    ].includes(size)
      ? size
      : "Size",

    color: [
      "Colour",
      "Flavour",
      "Style",
      "Material",
      "Option",
    ].includes(color)
      ? color
      : "Colour",
  };
}

export function buyingInformation(product = {}) {
  const delivery = product.delivery || {};

  function day(value) {
    if (
      value == null ||
      value === "" ||
      typeof value === "boolean"
    ) {
      return null;
    }

    const number = Number(value);

    return Number.isSafeInteger(number) &&
      number >= 0 &&
      number <= 365
      ? number
      : null;
  }

  const minimum = day(delivery.transitDaysMin);
  const maximum = day(delivery.transitDaysMax);

  const transit =
    minimum != null &&
    maximum != null &&
    maximum >= minimum
      ? `${
          minimum === maximum
            ? minimum
            : `${minimum}–${maximum}`
        } ${maximum === 1 ? "day" : "days"} after dispatch`
      : "";

  const policy = productText(product.returnPolicy);
  const conditions = productText(product.returnConditions);
  const window = day(product.returnWindowDays);

  let returns;

  if (product.returnsEligible === "no") {
    returns =
      "This product is listed as not eligible for routine returns. Contact support about damaged, incorrect or faulty items.";
  } else if (
    product.returnsEligible === "yes" &&
    (policy || conditions)
  ) {
    returns =
      window != null && window >= 1 && window <= 7
        ? `Return requests are accepted within ${window} ${
            window === 1 ? "day" : "days"
          } of delivery, subject to the conditions below.`
        : "Returns are listed as available. Confirm the request deadline and conditions with support before buying.";
  } else {
    returns =
      "Return eligibility has not been confirmed for this product. Check with support before buying.";
  }

  return {
    deliveryUnavailable: delivery.available === false,
    estimate: productText(delivery.estimatedDays),
    transit,
    returns,
    returnDetails: [
      ...new Set([policy, conditions].filter(Boolean)),
    ],
  };
}

export function customerSpecifications(product = {}) {
  const specific = product.specifications;

  const entries =
    specific &&
    typeof specific === "object" &&
    !Array.isArray(specific)
      ? Object.entries(specific)
      : [];

  const labels = optionLabels(product);

  const rows = [
    ["Brand", product.brand],
    ["Category", product.category],
    ["Product type", product.subcategory],
    ["Material", product.material],
    ["For", product.gender],
    ...entries,
    ["Product code", product.productCode],
    ["Product SKU", product.sku],
    ["In the box", product.whatsIncluded],
    [
      `Available ${labels.size.toLowerCase()}`,
      product.sizes,
    ],
    [
      `Available ${labels.color.toLowerCase()}`,
      product.colors,
    ],
  ];

  const unique = new Map();

  for (const [label, value] of rows) {
    const name = productText(label);
    const text = displayValue(value);

    if (name && text) {
      unique.set(name.toLowerCase(), [name, text]);
    }
  }

  const category = `${productText(
    product.category,
  )} ${productText(product.subcategory)}`;

  const priority = /bag/i.test(category)
    ? /dimension|capacity|compartment|material/i
    : /bottle|shaker/i.test(category)
      ? /capacity|volume|material|clean|care/i
      : /cloth|t-shirt|short|jogger|apparel/i.test(category)
        ? /fabric|material|fit|measurement/i
        : /dimension|material|intended use|specification/i;

  return [...unique.values()].sort(
    (a, b) =>
      Number(priority.test(b[0])) -
      Number(priority.test(a[0])),
  );
}

export function supplierSizeChart(product = {}) {
  const chart = product.sizeChart;

  if (
    !chart ||
    !Array.isArray(chart.columns) ||
    !Array.isArray(chart.rows)
  ) {
    return null;
  }

  const columns = chart.columns.map(productText);

  if (
    !columns.length ||
    columns.length > 20 ||
    columns.some((value) => !value)
  ) {
    return null;
  }

  const rows = chart.rows
    .filter(
      (row) =>
        Array.isArray(row) &&
        row.length === columns.length,
    )
    .map((row) => row.map(displayValue))
    .filter((row) => row.every((value) => value !== ""));

  if (!rows.length) {
    return null;
  }

  return {
    columns,
    rows,
    caption:
      productText(chart.caption) || "Supplier size chart",
  };
}