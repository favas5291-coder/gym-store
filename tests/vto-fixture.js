// A generated colour-grid PNG for transport/UI tests, not a person or AI result.
import { deflateSync } from "node:zlib";
const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc ^= value;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const size = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]),
    crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([size, body, crc]);
};
export function testImage(width = 600, height = 800, offset = 0) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const start = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      raw[start + 1 + x * 3] = Math.round((x / width) * 200) + offset;
      raw[start + 2 + x * 3] = Math.round((y / height) * 180);
      raw[start + 3 + x * 3] = 180;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
export const imageData = () =>
  `data:image/png;base64,${testImage().toString("base64")}`;