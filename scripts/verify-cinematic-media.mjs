// Production MP4 verification (no external npm dependency).
// Checks the real campaign files and reports deploy-time HTTP video headers.
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const assets = ["hero-mobile.mp4", "hero-desktop.mp4"];
const root = "media/campaign";

function atoms(data) {
  const result = [];
  for (let offset = 0; offset + 8 <= data.length;) {
    const size = data.readUInt32BE(offset);
    const name = data.toString("ascii", offset + 4, offset + 8);
    if (size < 8 || offset + size > data.length) throw new Error(`Malformed MP4 atom ${name} at ${offset}`);
    result.push({ name, offset, size });
    offset += size;
  }
  return result;
}

for (const name of assets) {
  const probe = spawnSync("ffprobe", [
    "-v", "error", "-show_entries",
    "stream=codec_name,profile,pix_fmt,width,height,level,codec_type",
    "-of", "json", `public/${root}/${name}`,
  ], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) {
    throw new Error(`ffprobe failed for ${name}: ${probe.stderr || probe.error?.message}`);
  }
  const streams = JSON.parse(probe.stdout).streams;
  const video = streams.find(stream => stream.codec_type === "video");
  const audio = streams.filter(stream => stream.codec_type === "audio");
  if (!video || video.codec_name !== "h264" || video.pix_fmt !== "yuv420p" || audio.length !== 0) {
    throw new Error(`iPhone MP4 incompatibility ${name}: ${JSON.stringify(streams)}`);
  }
  if (name === "hero-mobile.mp4" && (video.level > 42 || video.width > 1080 || video.height > 1920)) {
    throw new Error(`Mobile MP4 has an oversized H.264 level or resolution: ${JSON.stringify(video)}`);
  }
  console.log(`ffprobe ${name}: ${video.codec_name}, ${video.profile}, ${video.pix_fmt}, ${video.width}x${video.height}, level ${video.level / 10}, no audio`);
  const [source, deployed] = await Promise.all([
    readFile(`public/${root}/${name}`),
    readFile(`dist/${root}/${name}`),
  ]);
  if (!source.equals(deployed)) throw new Error(`Vite did not preserve production media: ${name}`);
  const boxes = atoms(source);
  const moov = boxes.find(x => x.name === "moov");
  const mdat = boxes.find(x => x.name === "mdat");
  if (!moov || !mdat || moov.offset > mdat.offset) throw new Error(`${name} lacks fast-start metadata`);
  const metadata = source.subarray(moov.offset, moov.offset + moov.size);
  const avc = metadata.indexOf(Buffer.from("avcC"));
  const entry = metadata.indexOf(Buffer.from("avc1"));
  if (entry < 0 || avc < 0) throw new Error(`${name} lacks H.264/AVC video`);
  const profile = metadata[avc + 5];
  const level = metadata[avc + 7];
  if (![66,77,100].includes(profile) || (name === "hero-mobile.mp4" && level > 42)) throw new Error(`Unexpected mobile H.264 profile/level: ${profile}/${level}`);
  console.log(`OK ${name}: ${source.length} bytes, avc1, H264 profile ${profile}, level ${level / 10}, faststart, included in dist`);
}

let networkProblem = false;
for (const name of assets) {
  const url = `https://www.gymdrobe.com/${root}/${name}`;
  try {
    const head = await fetch(url, {method: "HEAD", signal: AbortSignal.timeout(12000), redirect: "follow"});
    const range = await fetch(url, {
      headers: {Range: "bytes=0-1023"},
      signal: AbortSignal.timeout(12000), redirect: "follow",
    });
    const contentType = range.headers.get("content-type") ?? head.headers.get("content-type") ?? "";
    const contentRange = range.headers.get("content-range") ?? "";
    console.log(`LIVE ${name}: HEAD ${head.status}, Range ${range.status}, type=${contentType}, Content-Range=${contentRange || "not supplied"}`);
    await range.arrayBuffer();
    if (!head.ok || !range.ok || !contentType.toLowerCase().includes("video/mp4")) {
      networkProblem = true;
      console.warn(`WARN ${url} did not return a playable MP4 HTTP response`);
    }
    if (range.status !== 206) {
      networkProblem = true;
      console.warn(`WARN ${url} did not honor byte-range requests (expected HTTP 206)`);
    }
  } catch (error) {
    networkProblem = true;
    console.warn(`WARN unable to check ${url}: ${error.message}`);
  }
}
if (networkProblem) {
  console.warn("Production media HTTP checks need investigation; local video assets validated successfully.");
}
