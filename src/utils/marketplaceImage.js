function dataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read the selected photo."));
    reader.readAsDataURL(blob);
  });
}

function decode(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This photo could not be opened. Choose another image."));
    image.src = source;
  });
}

export async function compressSupplierImage(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP image.");
  }
  if (file.size > 12 * 1024 * 1024) throw new Error("Choose a photo under 12 MB.");
  const url = URL.createObjectURL(file);
  try {
    // Some WebKit file pickers supply readable bytes but cannot decode the
    // transient object URL. Retry the same bounded input through FileReader.
    const image = await decode(url).catch(async () => decode(await dataUrl(file)));
    const { naturalWidth: width, naturalHeight: height } = image;
    if (width * height > 24000000 || width < 32 || height < 32) {
      throw new Error("Choose a photo between 32px and 24 megapixels.");
    }
    const scale = Math.min(1, 1280 / width, 1280 / height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [.82, .68, .52]) {
      const blob = await new Promise(done => canvas.toBlob(done, "image/jpeg", quality));
      if (blob && blob.size <= 524288) return { mime: blob.type, base64: (await dataUrl(blob)).split(",")[1] };
    }
    throw new Error("Crop this image and retry; it is too large after compression.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
