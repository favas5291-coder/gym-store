import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { VtoError, validateImage } from "./image.mjs";

const COOKIE = "gdvto";
const SESSION_TTL = 30 * 60 * 1000;
const JOB_TTL = 15 * 60 * 1000;
const MAX_BODY = 12 * 1024 * 1024;
const validKey = (value) =>
  typeof value === "string" && /^[A-Za-z0-9-]{16,80}$/.test(value);
const fail = (status, message, code = "INVALID_REQUEST") => {
  throw new VtoError(status, message, code);
};
function equal(first, second) {
  const a = Buffer.from(String(first || "")),
    b = Buffer.from(String(second || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}
async function readBody(req) {
  if (
    !String(req.headers["content-type"] || "")
      .toLowerCase()
      .startsWith("application/json")
  )
    fail(415, "Send application/json.");
  if (Number(req.headers["content-length"] || 0) > MAX_BODY)
    fail(413, "The photo is too large.");
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_BODY) fail(413, "The photo is too large.");
    chunks.push(Buffer.from(chunk));
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body))
      fail(400, "Invalid request.");
    return body;
  } catch {
    fail(400, "Invalid request.");
  }
}

export function createHandler({
  catalog,
  provider = null,
  store,
  secret,
  origin,
  limits = {},
  now = () => Date.now(),
}) {
  if (!store || !catalog?.assets || !catalog?.products)
    throw new Error("Catalog and job store are required.");
  if (typeof secret !== "string" || secret.length < 32)
    throw new Error("Use a session secret of at least 32 characters.");
  const allowedOrigin = new URL(origin).origin;
  const sign = (value) =>
    createHmac("sha256", secret).update(value).digest("hex");
  function json(res, status, body) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    res.end(JSON.stringify(body));
  }
  function session(req, res, create) {
    const cookie = String(req.headers.cookie || "")
      .split(";")
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    const parts = String(cookie || "").split(".");
    let visitor, expires;
    if (
      parts.length === 3 &&
      /^[a-f0-9]{48}$/.test(parts[0]) &&
      equal(parts[2], sign(`${parts[0]}.${parts[1]}`)) &&
      Number(parts[1]) > now()
    ) {
      visitor = parts[0];
      expires = Number(parts[1]);
    } else {
      if (!create) fail(401, "Reopen the fitting room to start a new session.");
      visitor = randomBytes(24).toString("hex");
      expires = now() + SESSION_TTL;
      const value = `${visitor}.${expires}`;
      res.setHeader(
        "Set-Cookie",
        `${COOKIE}=${value}.${sign(value)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800${allowedOrigin.startsWith("https:") ? "; Secure" : ""}`,
      );
    }
    return { visitor, csrf: sign(`csrf:${visitor}:${expires}`) };
  }
  function responseFor(job) {
    return {
      id: job.requestKey,
      status: job.status,
      productId: job.productId,
      color: job.color,
      message: job.message,
    };
  }
  return async function handler(req, res) {
    try {
      const url = new URL(req.url, allowedOrigin);
      if (url.pathname !== "/api/virtual-try-on")
        return json(res, 404, { message: "Not found." });
      if (req.headers.origin && req.headers.origin !== allowedOrigin)
        fail(403, "This website is not allowed to use the fitting room.");
      if (req.headers["sec-fetch-site"] === "cross-site")
        fail(403, "Cross-site requests are not allowed.");
      if (req.headers.host !== new URL(allowedOrigin).host)
        fail(403, "Unexpected request host.");
      const action = url.searchParams.get("action");
      if (!(
        (action === "config" && req.method === "GET") ||
        (action === "generate" && req.method === "POST") ||
        (action === "job" && ["GET", "DELETE"].includes(req.method))
      ))
        fail(405, "Method not allowed.");
      if (action === "generate" && !provider)
        fail(503, "Photo try-on is not configured yet.", "NOT_CONFIGURED");
      const user = session(req, res, action === "config");
      if (
        req.method !== "GET" &&
        (req.headers.origin !== allowedOrigin ||
          !equal(req.headers["x-gymdrobe-token"], user.csrf))
      )
        fail(403, "Reopen the fitting room and try again.");
      if (action === "config")
        return json(res, 200, {
          configured: Boolean(provider),
          csrf: user.csrf,
          products: catalog.products,
        });
      if (action === "generate") {
        const body = await readBody(req);
        if (!validKey(body.requestKey)) fail(400, "Invalid preview request.");
        const key = `job:${user.visitor}:${body.requestKey}`;
        const previous = store.get(key);
        if (previous) return json(res, 202, responseFor(previous));
        if (body.consent !== true)
          fail(400, "Agree to photo processing before generating a preview.");
        if (
          typeof body.productId !== "string" ||
          typeof body.color !== "string"
        )
          fail(400, "Invalid product selection.");
        const asset = catalog.assets.get(
          JSON.stringify([body.productId, body.color]),
        );
        if (!asset)
          fail(422, "A verified photo for this colour is not available yet.");
        validateImage(body.personImage);
        const ip = req.socket?.remoteAddress || "unknown";
        const day = Math.floor(now() / 86400000);
        const counters = [
          [`visitor:${user.visitor}`, limits.visitor ?? 5, SESSION_TTL],
          [`ip:${ip}:${day}`, limits.ip ?? 20, 86400000],
          [`daily:${day}`, limits.daily ?? 30, 86400000],
        ];
        for (const [counter, maximum] of counters)
          if ((store.get(counter) || 0) >= maximum)
            fail(
              429,
              "The preview limit has been reached. Please try again later.",
            );
        const active = store.get(`active:${user.visitor}`);
        if (active) {
          const pending = store.get(active);
          if (
            pending &&
            !["failed", "completed", "cancelled"].includes(pending.status) &&
            now() - pending.created < 240000
          )
            fail(
              409,
              "A preview is already processing. Wait for it to finish.",
            );
        }
        // Claim before awaiting the provider, so repeated clicks cannot start another paid job.
        const job = {
          requestKey: body.requestKey,
          productId: body.productId,
          color: body.color,
          status: "starting",
          created: now(),
          providerId: null,
        };
        store.set(key, job, JOB_TTL);
        store.set(`active:${user.visitor}`, key, 240000);
        for (const [counter, , ttl] of counters) store.increment(counter, ttl);
        try {
          const providerId = await provider.start(body.personImage, asset);
          if (job.status !== "cancelled") {
            job.providerId = providerId;
            job.status = "in_queue";
          }
        } catch {
          if (job.status !== "cancelled") {
            job.status = "failed";
            job.message =
              "The preview could not be started. Please try again later.";
          }
        }
        return json(res, 202, responseFor(job));
      }
      const id = url.searchParams.get("id");
      if (!validKey(id)) fail(400, "Invalid preview ID.");
      const key = `job:${user.visitor}:${id}`;
      let job = store.get(key);
      if (req.method === "DELETE") {
        if (job) {
          job.status = "cancelled";
          delete job.providerId;
        } else
          store.set(
            key,
            { requestKey: id, status: "cancelled", created: now() },
            JOB_TTL,
          );
        return json(res, 200, { removed: true });
      }
      if (!job || job.status === "cancelled")
        fail(410, "This preview expired or is no longer available.");
      if (now() - job.created >= 240000)
        fail(408, "This preview took too long. Start a new preview later.");
      if (job.status === "failed" || !job.providerId)
        return json(res, 200, responseFor(job));
      if (!provider) fail(503, "The preview service is unavailable.");
      let result;
      try {
        result = await provider.status(job.providerId);
      } catch {
        job.status = "failed";
        job.message =
          "The preview service is unavailable. Please try again later.";
        return json(res, 200, responseFor(job));
      }
      if (job.status === "cancelled") fail(410, "This preview was stopped.");
      if (
        !result ||
        !["starting", "in_queue", "processing", "completed", "failed"].includes(
          result.status,
        )
      )
        fail(502, "The preview status was invalid.");
      if (result.status === "completed")
        validateImage(result.image, { minSide: 64, maxBytes: 3 * 1024 * 1024 });
      job.status = result.status;
      if (result.status === "failed")
        job.message = result.message || "The preview could not be generated.";
      // Images are returned directly, never stored in job metadata.
      return json(res, 200, {
        ...responseFor(job),
        ...(result.status === "completed" ? { image: result.image } : {}),
      });
    } catch (error) {
      if (!res.headersSent)
        json(res, error instanceof VtoError ? error.status : 500, {
          message:
            error instanceof VtoError
              ? error.message
              : "The fitting room is temporarily unavailable.",
          code: error instanceof VtoError ? error.code : "SERVER_ERROR",
        });
      else res.end();
    }
  };
}
