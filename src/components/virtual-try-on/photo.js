export const PHOTO_ERRORS = {
  PERSON_NOT_DETECTED:
    "We could not find a clear person in this photo. Face the camera and include your torso and hips.",
  MULTIPLE_PEOPLE:
    "There is more than one person in this photo. Choose a photo of just you.",
  LOW_QUALITY:
    "This photo looks too dark, bright or blurred. Try again in even lighting and hold the camera steady.",
  BODY_HIDDEN:
    "We cannot see the area needed for this product clearly. Include your torso and hips, or both feet for shoes.",
  CHECK_UNAVAILABLE:
    "The photo check could not load. Check your connection, then choose the photo again.",
};
export function checkAnalysis(analysis, category = "tops") {
  if (!analysis || !Array.isArray(analysis.poses))
    return PHOTO_ERRORS.CHECK_UNAVAILABLE;
  if (!analysis.poses.length) return PHOTO_ERRORS.PERSON_NOT_DETECTED;
  if (analysis.poses.length > 1) return PHOTO_ERRORS.MULTIPLE_PEOPLE;
  if (analysis.mean < 18 || analysis.mean > 244 || analysis.sharpness < 8)
    return PHOTO_ERRORS.LOW_QUALITY;
  const required =
    category === "shoes"
      ? [27, 28, 31, 32]
      : category === "bottoms"
        ? [23, 24, 27, 28]
        : [11, 12, 23, 24];
  if (
    required.some((i) => {
      const p = analysis.poses[0][i];
      return (
        !p || p.visibility < 0.45 || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1
      );
    })
  )
    return PHOTO_ERRORS.BODY_HIDDEN;
  return "";
}
const readBlob = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () =>
      reject(new Error("We could not open this photo. Please try another."));
    reader.readAsDataURL(blob);
  });
export async function preparePhoto(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(
      "Choose a JPEG, PNG or WebP photo. Convert HEIC photos to JPEG first.",
    );
  if (!file.size || file.size > 8 * 1024 * 1024)
    throw new Error("Please choose a photo smaller than 8 MB.");
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "This photo could not be opened. Please choose another JPEG or PNG.",
    );
  }
  try {
    const { width, height } = bitmap;
    if (Math.min(width, height) < 384)
      throw new Error(
        "Please choose a sharper photo, at least 384 pixels on each side.",
      );
    if (
      width * height > 48000000 ||
      width / height > 3 ||
      width / height < 0.33
    )
      throw new Error(
        "Use a normal portrait or full-body photo, not a panorama.",
      );
    const scale = Math.min(1, 1800 / Math.max(width, height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not prepare this photo.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // Re-encoding strips EXIF/location metadata and keeps requests below platform limits.
    let blob;
    for (const quality of [0.92, 0.85, 0.75, 0.65]) {
      blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= 1600000) break;
    }
    if (!blob || blob.size > 1600000)
      throw new Error(
        "Please choose a smaller photo so we can prepare your preview.",
      );
    return {
      blob,
      dataUrl: await readBlob(blob),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    bitmap.close();
  }
}
export function analyzePhoto(blob, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    let worker;
    try {
      worker = new Worker("/vto-assets/check-photo.worker.js");
    } catch {
      reject(new Error(PHOTO_ERRORS.CHECK_UNAVAILABLE));
      return;
    }
    const finish = (error, value) => {
      clearTimeout(timer);
      worker.terminate();
      signal.removeEventListener("abort", abort);
      error ? reject(error) : resolve(value);
    };
    const abort = () => finish(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(
      () => finish(new Error(PHOTO_ERRORS.CHECK_UNAVAILABLE)),
      60000,
    );
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }) =>
      data.error
        ? finish(new Error(PHOTO_ERRORS.CHECK_UNAVAILABLE))
        : finish(null, data);
    worker.onerror = () => finish(new Error(PHOTO_ERRORS.CHECK_UNAVAILABLE));
    worker.postMessage(blob);
  });
}
export function resultBlob(data) {
  const match =
    /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      data || "",
    );
  if (!match || data.length > 4400000)
    throw new Error("The preview image could not be opened. Please try again.");
  const raw = atob(match[2]),
    bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: match[1] });
}