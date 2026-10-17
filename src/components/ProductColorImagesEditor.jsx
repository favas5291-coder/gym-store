import { useId } from "react";

import {
  ProductVideoField,
} from "./ProductVideo.jsx";

import {
  ProductImage,
} from "./StorefrontShared.jsx";

import {
  isProductImageSource,
} from "../utils/productImages.js";

import "./ProductColorImages.css";

export default function ProductColorImagesEditor({
  draft,
  setDraft,
  disabled = false,
}) {
  const id = useId();

  const colors = [
    ...new Set(
      String(draft.colorsText || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];

  return (
    <div className="gd-color-editor">
      <ProductVideoField
        draft={draft}
        setDraft={setDraft}
        disabled={disabled}
      />

      <h4>
        Photos for each colour or option
      </h4>

      <p className="ap-help">
        First enter available colours in Options and stock.
        Paste one hosted image link or website image path
        per line below. The first photo is that colour’s
        main image. Every size of the same colour shares
        these photos.
      </p>

      <p className="ap-help">
        Leave a colour empty to use the default product
        photos. Clear its links to remove its assigned
        photos. Up to 20 photos per colour, with 100 colour
        photos in total.
      </p>

      {!colors.length && (
        <p>
          Add available colours to show their photo fields
          here.
        </p>
      )}

      <div className="gd-color-editor-grid">
        {colors.map((color, index) => {
          const value =
            typeof draft.colorImagesText?.[color] ===
            "string"
              ? draft.colorImagesText[color]
              : "";

          const photos = value
            .split(/\r?\n/)
            .map((value) => value.trim())
            .filter(Boolean);

          const field =
            `${id}-photos-${index}`;

          const hasInvalidPhoto = photos.some(
            (photo) => !isProductImageSource(photo),
          );

          return (
            <fieldset
              key={color}
              className="gd-color-photo-group"
              disabled={disabled}
            >
              <legend>{color}</legend>

              <label htmlFor={field}>
                Photo links for {color}
              </label>

              <textarea
                id={field}
                value={value}
                rows={4}
                maxLength={42000}
                placeholder={
                  `https://your-image-host.com/` +
                  `${encodeURIComponent(
                    color.toLowerCase(),
                  )}-front.jpg`
                }
                aria-describedby={`${field}-help`}
                onChange={(event) => {
                  const next = event.target.value;

                  setDraft((current) => ({
                    ...current,

                    colorImagesText: {
                      ...(current.colorImagesText || {}),
                      [color]: next,
                    },
                  }));
                }}
              />

              <p
                id={`${field}-help`}
                className="ap-help"
              >
                {photos.length} assigned photo(s).{" "}
                {photos.length
                  ? "The first appears when this colour is selected."
                  : "Uses default product photos."}
              </p>

              {hasInvalidPhoto && (
                <p
                  className="field-error"
                  role="alert"
                >
                  Use hosted HTTP/HTTPS images or website
                  image paths. Check for local files,
                  unsafe URLs or localhost links.
                </p>
              )}

              <div className="gd-color-photo-previews">
                {photos
                  .filter(isProductImageSource)
                  .slice(0, 20)
                  .map((source, position) => (
                    <figure
                      key={`${position}:${source}`}
                    >
                      <ProductImage
                        product={{
                          name:
                            `${draft.name || "Product"}` +
                            ` · ${color}`,
                          image: source,
                        }}
                      />

                      <figcaption>
                        {position === 0
                          ? "Main photo"
                          : `Photo ${position + 1}`}
                      </figcaption>
                    </figure>
                  ))}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}