import { useState } from "react";

import { ProductImage } from "./StorefrontShared.jsx";
import { safeMeeshoLink } from "../utils/meeshoUrl.js";

export default function AdminItemSourcing({ item }) {
  const [notice, setNotice] = useState("");

  const sourcing = item.sourcing || {};
  const link = safeMeeshoLink(sourcing.meeshoProductLink);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Meesho link copied.");
    } catch {
      setNotice(
        "Copy is unavailable. Select and copy the displayed link."
      );
    }
  }

  const sourceDescription =
    sourcing.source === "snapshot"
      ? "Meesho link saved with this order."
      : "Current product link — this older order has no sourcing snapshot.";

  const missingDescription = !item.sourcing
    ? "Sourcing details are unavailable. Update the backend and reload this order."
    : sourcing.source === "snapshot"
      ? "Meesho link not added when this order was created."
      : sourcing.source === "current-product"
        ? "Meesho link not added on the current product."
        : "Meesho link not added.";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "16px",
        minWidth: 0,
        flex: "1 1 240px",
      }}
    >
      <div
        style={{
          width: "88px",
          height: "110px",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        <ProductImage
          product={item}
          className="admin-sourcing-image"
        />
      </div>

      <div
        style={{
          flex: "1 1 220px",
          minWidth: 0,
          overflowWrap: "anywhere",
        }}
      >
        <strong>{item.name}</strong>

        <p className="muted">
          Quantity: <strong>{item.quantity}</strong>

          {item.selectedSize
            ? ` · ${sourcing.sizeLabel || "Size"}: ${item.selectedSize}`
            : ""}

          {item.selectedColor
            ? ` · ${sourcing.colorLabel || "Colour"}: ${item.selectedColor}`
            : ""}

          {item.sku ? ` · SKU: ${item.sku}` : ""}
        </p>

        {link ? (
          <>
            <div className="purchase-actions">
              <a
                className="button secondary compact"
                href={link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Meesho Product
              </a>

              <button
                type="button"
                className="button secondary compact"
                onClick={copyLink}
              >
                Copy Link
              </button>
            </div>

            <p className="muted">{sourceDescription}</p>

            <input
              aria-label={`Meesho product link for ${item.name}`}
              value={link}
              readOnly
              onFocus={(event) => event.target.select()}
              style={{
                width: "100%",
                minHeight: "44px",
              }}
            />

            <p className="muted">
              Purchase manually. Match the selected options and
              quantity, and check the current listing&apos;s price
              and availability.
            </p>
          </>
        ) : (
          <p className="muted">{missingDescription}</p>
        )}

        {notice && <p role="status">{notice}</p>}
      </div>

      <style>
        {`
          .admin-sourcing-image {
            width: 88px;
            height: 110px;
            object-fit: contain;
          }
        `}
      </style>
    </div>
  );
}