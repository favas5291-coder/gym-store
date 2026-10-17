import {
  useId,
  useState,
} from "react";

import {
  normalizeProductVideo,
  productVideo,
} from "../utils/productVideo.js";

import {
  ProductImage,
  resolveProductImage,
} from "./StorefrontShared.jsx";

import "./ProductVideo.css";

function VideoPlayer({
  media,
  product,
}) {
  const [opened, setOpened] =
    useState(false);

  const [failed, setFailed] =
    useState(false);

  const title =
    `${product?.name || "Product"} video`;

  const poster = resolveProductImage(
    product?.image,
  );

  return (
    <div className="gd-product-video">
      <h3>See the product in action</h3>

      <div className="gd-product-video-frame">
        {!opened ? (
          <button
            type="button"
            className="gd-product-video-launch"
            aria-label={`Load ${title}`}
            onClick={() => setOpened(true)}
          >
            <ProductImage
              product={product}
              decorative
            />

            <span
              className="gd-product-video-play"
              aria-hidden="true"
            >
              ▶
            </span>

            <span className="gd-product-video-label">
              Watch product video
            </span>
          </button>
        ) : media.kind === "youtube" ? (
          <iframe
            src={media.src}
            title={title}
            loading="lazy"
            allow="encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : !failed ? (
          <video
            src={media.src}
            poster={poster || undefined}
            controls
            playsInline
            preload="metadata"
            aria-label={title}
            onError={() => setFailed(true)}
          >
            Your browser cannot play this video.
          </video>
        ) : (
          <div
            className="gd-product-video-error"
            role="alert"
          >
            <p>
              This video could not be played.
              You can still browse the product
              photos.
            </p>

            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setFailed(false);
                setOpened(false);
              }}
            >
              Try video again
            </button>
          </div>
        )}
      </div>

      {opened && (
        <a
          className="text-link gd-product-video-external"
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open video in a new tab
        </a>
      )}

      {media.kind === "youtube" &&
        !opened && (
          <p className="muted gd-product-video-note">
            Loading the video connects to YouTube.
          </p>
        )}
    </div>
  );
}

export default function ProductVideo({
  product,
}) {
  const media = productVideo(
    product?.videoUrl,
  );

  if (!media) {
    return null;
  }

  return (
    <VideoPlayer
      key={media.url}
      media={media}
      product={product}
    />
  );
}

export function ProductVideoField({
  draft,
  setDraft,
  disabled = false,
}) {
  const id = useId();

  const value =
    typeof draft.videoUrl === "string"
      ? draft.videoUrl
      : "";

  let error = "";

  try {
    normalizeProductVideo(value);
  } catch (failure) {
    error = failure.message;
  }

  return (
    <fieldset
      className="gd-product-video-editor"
      disabled={disabled}
    >
      <legend>
        Product video · optional
      </legend>

      <label htmlFor={`${id}-video`}>
        Product video link
      </label>

      <input
        id={`${id}-video`}
        name="videoUrl"
        type="url"
        maxLength={2000}
        value={value}
        placeholder="https://your-video-host.com/product.mp4"
        aria-invalid={Boolean(error)}
        aria-describedby={
          `${id}-video-help` +
          (
            error
              ? ` ${id}-video-error`
              : ""
          )
        }
        onChange={(event) => {
          const next = event.target.value;

          setDraft((current) => ({
            ...current,
            videoUrl: next,
          }));
        }}
      />

      <p
        className="ap-help"
        id={`${id}-video-help`}
      >
        Paste a public HTTPS .mp4 or .webm link,
        or a YouTube video/Shorts link.
        This video is visible to customers.
        Use a video you have permission to publish.
        Clear the field to remove it.
        Local computer files and product-page
        links cannot play here.
      </p>

      {error && (
        <p
          className="field-error"
          role="alert"
          id={`${id}-video-error`}
        >
          {error}
        </p>
      )}

      {!error && value.trim() && (
        <ProductVideo
          product={{
            name: draft.name,
            image: draft.image,
            videoUrl: value,
          }}
        />
      )}
    </fieldset>
  );
}