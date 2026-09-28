import { VtoError, validateImage } from "./image.mjs";
const API = "https://api.fashn.ai/v1";
export function providerError(name) {
  const errors = {
    PoseError: [
      "PERSON_NOT_DETECTED",
      "We could not identify a clear body pose. Use a photo with one person and the clothing area fully visible.",
    ],
    ImageLoadError: [
      "PHOTO_UNREADABLE",
      "The photo could not be read. Please upload a new JPEG or PNG.",
    ],
    ContentModerationError: [
      "PHOTO_NOT_ALLOWED",
      "Please choose an appropriate, fully clothed photo that you have permission to use.",
    ],
    InputValidationError: [
      "PRODUCT_NOT_APPLIED",
      "This product and photo could not be combined. Try a clearer photo or another product.",
    ],
    ThirdPartyError: [
      "GENERATION_FAILED",
      "The AI service could not create this preview. Try a different photo, or try again later.",
    ],
    UnavailableError: [
      "SERVICE_BUSY",
      "The AI service is busy. Please try again in a moment.",
    ],
  };
  const [code, message] = errors[name] || [
    "GENERATION_FAILED",
    "We could not create this try-on. Please try another photo or try again later.",
  ];
  return { code, message };
}
export function fashnProvider(apiKey, fetchImpl = fetch) {
  async function request(path, body) {
    let response;
    try {
      response = await fetchImpl(API + path, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(40000),
        redirect: "error",
      });
    } catch {
      throw new VtoError(
        503,
        "The AI service did not respond. Please try again later.",
        "SERVICE_UNAVAILABLE",
      );
    }
    if (!response.ok)
      throw new VtoError(
        response.status === 429 ? 503 : 502,
        response.status === 429
          ? "Try-on is temporarily busy. Please try again later."
          : "The AI service is unavailable. Please contact the store if this continues.",
        "SERVICE_UNAVAILABLE",
      );
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > 5 * 1024 * 1024)
        throw new VtoError(
          502,
          "The preview is too large to display. Please try again.",
          "RESULT_TOO_LARGE",
        );
      chunks.push(Buffer.from(chunk));
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      throw new VtoError(
        502,
        "The AI service returned an unreadable response.",
        "INVALID_RESULT",
      );
    }
  }
  return {
    async start(personImage, productImage) {
      const data = await request("/run", {
        model_name: "tryon-max",
        inputs: {
          model_image: personImage,
          product_image: productImage,
          prompt:
            "Preserve the person’s face, identity, body proportions, pose, skin tone, and original background. Apply only the provided product with its original colour, pattern, branding and details. Match the existing lighting and perspective with natural garment folds and shadows. Do not reshape the person or alter unrelated clothing.",
          resolution: "2k",
          generation_mode: "quality",
          output_format: "jpeg",
          return_base64: true,
          num_images: 1,
        },
      });
      if (data.error || !/^[\w-]{1,150}$/.test(data.id || ""))
        throw new VtoError(
          502,
          "The preview could not be started. Please try again later.",
          "GENERATION_FAILED",
        );
      return data.id;
    },
    async status(id) {
      const data = await request("/status/" + encodeURIComponent(id));
      if (data.status === "failed" || data.error)
        return { status: "failed", ...providerError(data.error?.name) };
      if (data.status === "completed") {
        try {
          validateImage(data.output?.[0], {
            minSide: 64,
            maxBytes: 3 * 1024 * 1024,
          });
        } catch {
          throw new VtoError(
            502,
            "This preview could not be displayed. Please try again.",
            "INVALID_RESULT",
          );
        }
        return { status: "completed", image: data.output[0] };
      }
      if (!["starting", "in_queue", "processing"].includes(data.status))
        throw new VtoError(
          502,
          "The preview status is unavailable. Please try again.",
          "INVALID_RESULT",
        );
      return { status: data.status };
    },
  };
}