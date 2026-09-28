export class VtoError extends Error {
  constructor(status, message, code = "INVALID_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const fail = (message) => {
  throw new VtoError(400, message);
};
function dimensions(bytes, type) {
  if (type === "image/png") {
    if (
      bytes.length < 33 ||
      !bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
      bytes.toString("ascii", 12, 16) !== "IHDR"
    )
      fail("Invalid PNG photo.");
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  }
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216)
    fail("Invalid JPEG photo.");
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i++] !== 255) continue;
    while (bytes[i] === 255) i++;
    const marker = bytes[i++];
    if (marker === 217 || marker === 218) break;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    if (i + 2 > bytes.length) break;
    const length = bytes.readUInt16BE(i);
    if (length < 2 || i + length > bytes.length) break;
    if (
      [
        192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
      ].includes(marker) &&
      length >= 7
    )
      return [bytes.readUInt16BE(i + 5), bytes.readUInt16BE(i + 3)];
    i += length;
  }
  fail("The JPEG dimensions could not be read.");
}
export function validateImage(
  data,
  { minSide = 384, maxBytes = 8 * 1024 * 1024, maxPixels = 24000000 } = {},
) {
  if (
    typeof data !== "string" ||
    data.length > Math.ceil((maxBytes * 4) / 3) + 100
  )
    fail("The image exceeds the upload limit.");
  const match =
    /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
  if (!match) fail("Send a JPEG or PNG photo, not an image URL.");
  const bytes = Buffer.from(match[2], "base64");
  if (
    !bytes.length ||
    bytes.length > maxBytes ||
    bytes.toString("base64") !== match[2]
  )
    fail("Invalid image data.");
  const [width, height] = dimensions(bytes, match[1]);
  if (
    Math.min(width, height) < minSide ||
    width * height > maxPixels ||
    width / height > 4 ||
    width / height < 0.25
  )
    fail("Use a clear photo with a normal portrait or landscape shape.");
  return { type: match[1], bytes, width, height };
}