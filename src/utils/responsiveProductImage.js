const WIDTHS = [
  160,
  240,
  320,
  480,
  640,
  900,
  1200,
  1600,
];

// Generate smaller image options for compatible CDN links.
// Other hosts, signed links, local files and previews
// keep their existing image URLs.
export function responsiveProductImage(source) {
  if (typeof source !== "string") {
    return null;
  }

  try {
    const url = new URL(source);

    const supportedPath =
      /^\/(?:cdn\/shop\/(?:files|products)\/|s\/files\/)/.test(
        url.pathname,
      );

    const unsupportedParameter = [
      ...url.searchParams.keys(),
    ].some(
      (key) =>
        ![
          "v",
          "width",
          "height",
          "crop",
          "format",
        ].includes(key),
    );

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !supportedPath ||
      (
        url.pathname.startsWith("/s/files/") &&
        url.hostname !== "cdn.shopify.com"
      ) ||
      unsupportedParameter
    ) {
      return null;
    }

    const savedWidth = Number(
      url.searchParams.get("width"),
    );

    if (
      !Number.isSafeInteger(savedWidth) ||
      savedWidth < 160 ||
      savedWidth > 5760
    ) {
      return null;
    }

    // Never request images larger than the saved width.
    const widths = [
      ...new Set([
        ...WIDTHS.filter(
          (width) => width < savedWidth,
        ),
        savedWidth,
      ]),
    ];

    if (widths.length < 2) {
      return null;
    }

    return widths
      .map((width) => {
        const image = new URL(url);

        image.searchParams.set(
          "width",
          String(width),
        );

        const height = Number(
          url.searchParams.get("height"),
        );

        // Preserve the existing crop's aspect ratio.
        if (
          Number.isSafeInteger(height) &&
          height > 0 &&
          height <= 5760
        ) {
          image.searchParams.set(
            "height",
            String(
              Math.max(
                1,
                Math.round(
                  (height * width) / savedWidth,
                ),
              ),
            ),
          );
        }

        return `${image.href} ${width}w`;
      })
      .join(", ");
  } catch {
    return null;
  }
}