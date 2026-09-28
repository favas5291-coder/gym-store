import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { createHandler } from "../server/virtual-try-on/handler.mjs";
import { memoryStore } from "../server/virtual-try-on/store.mjs";
import {
  providerError,
  fashnProvider,
} from "../server/virtual-try-on/provider.mjs";
import {
  checkAnalysis,
  PHOTO_ERRORS,
} from "../src/components/virtual-try-on/photo.js";
import { imageData } from "./vto-fixture.js";
const secret = "test-only-session-secret-with-32-characters";
const pose = () =>
  Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
test("photo checks handle zero people, multiple people, blur, poor lighting and hidden feet", () => {
  const base = { poses: [pose()], mean: 125, sharpness: 100 };
  assert.equal(checkAnalysis(base), "");
  assert.equal(
    checkAnalysis({ ...base, poses: [] }),
    PHOTO_ERRORS.PERSON_NOT_DETECTED,
  );
  assert.equal(
    checkAnalysis({ ...base, poses: [pose(), pose()] }),
    PHOTO_ERRORS.MULTIPLE_PEOPLE,
  );
  assert.equal(checkAnalysis({ ...base, mean: 2 }), PHOTO_ERRORS.LOW_QUALITY);
  assert.equal(
    checkAnalysis({ ...base, sharpness: 2 }),
    PHOTO_ERRORS.LOW_QUALITY,
  );
  base.poses[0][31].visibility = 0.1;
  assert.equal(checkAnalysis(base, "shoes"), PHOTO_ERRORS.BODY_HIDDEN);
  assert.equal(checkAnalysis(null), PHOTO_ERRORS.CHECK_UNAVAILABLE);
});
test("provider errors have useful messages without exposing raw payloads", () => {
  for (const name of [
    "PoseError",
    "ImageLoadError",
    "ContentModerationError",
    "InputValidationError",
    "ThirdPartyError",
    "UnavailableError",
    "AnythingElse",
  ])
    assert.ok(providerError(name).message.length > 30);
  assert.equal(
    providerError("InputValidationError").code,
    "PRODUCT_NOT_APPLIED",
  );
});
async function setup(
  t,
  {
    limits = { visitor: 20, ip: 30, daily: 40 },
    provider,
    configured = true,
  } = {},
) {
  let handler,
    starts = 0,
    time = Date.now();
  const store = memoryStore(() => time);
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const catalog = {
    products: { 1: { colors: ["Black"] } },
    assets: new Map([[JSON.stringify(["1", "Black"]), imageData()]]),
  };
  const engine = provider || {
    start: async () => {
      starts++;
      return "provider-job";
    },
    status: async () => ({ status: "completed", image: imageData() }),
  };
  const options = {
    catalog,
    store,
    provider: configured ? engine : null,
    secret,
    origin,
    limits,
    now: () => time,
  };
  handler = createHandler(options);
  async function session() {
    const r = await fetch(origin + "/api/virtual-try-on?action=config");
    const data = await r.json();
    return {
      csrf: data.csrf,
      cookie: r.headers.get("set-cookie")?.split(";")[0],
      data,
    };
  }
  async function call(
    action,
    { method = "GET", user, id, body, headers = {} } = {},
  ) {
    const response = await fetch(
      `${origin}/api/virtual-try-on?action=${action}${id ? "&id=" + id : ""}`,
      {
        method,
        headers: {
          Origin: origin,
          ...(user
            ? { Cookie: user.cookie, "X-GymDrobe-Token": user.csrf }
            : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    return {
      status: response.status,
      data: await response.json(),
      headers: response.headers,
    };
  }
  return {
    session,
    call,
    store,
    starts: () => starts,
    advance: (ms) => (time += ms),
    restart: () => (handler = createHandler(options)),
    input: () => ({
      requestKey: randomUUID(),
      productId: "1",
      color: "Black",
      personImage: imageData(),
      consent: true,
    }),
  };
}
test("generation works across fresh handler instances; job metadata never contains images", async (t) => {
  const app = await setup(t),
    user = await app.session(),
    input = app.input();
  assert.equal(user.data.configured, true);
  assert.equal(
    (await app.call("generate", { method: "POST", user, body: input })).status,
    202,
  );
  app.restart();
  const result = await app.call("job", { user, id: input.requestKey });
  assert.equal(result.data.status, "completed");
  assert.match(result.data.image, /^data:image\/png/);
  assert.equal(result.headers.get("cache-control"), "no-store, private");
  const second = await app.session();
  assert.equal(
    (await app.call("job", { user: second, id: input.requestKey })).status,
    410,
  );
  await app.call("job", { method: "DELETE", user, id: input.requestKey });
  assert.equal(
    (await app.call("job", { user, id: input.requestKey })).status,
    410,
  );
});
test("concurrent duplicate submissions create only one provider request", async (t) => {
  const app = await setup(t),
    user = await app.session(),
    body = app.input();
  const responses = await Promise.all([
    app.call("generate", { method: "POST", user, body }),
    app.call("generate", { method: "POST", user, body }),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [202, 202],
  );
  assert.equal(app.starts(), 1);
});
test("consent, valid image, approved colour, session and origin are required", async (t) => {
  const app = await setup(t),
    user = await app.session(),
    body = app.input();
  assert.equal(
    (await app.call("generate", { method: "POST", body })).status,
    401,
  );
  assert.equal(
    (
      await app.call("generate", {
        method: "POST",
        user,
        body,
        headers: { "X-GymDrobe-Token": "invalid" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await app.call("generate", {
        method: "POST",
        user,
        body,
        headers: { Origin: "https://another-site.example" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await app.call("generate", {
        method: "POST",
        user,
        body: { ...body, consent: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await app.call("generate", {
        method: "POST",
        user,
        body: { ...body, color: "Blue" },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await app.call("generate", {
        method: "POST",
        user,
        body: { ...body, personImage: "https://example.com/person.png" },
      })
    ).status,
    400,
  );
  assert.equal(app.starts(), 0);
});
test("deleting before submission prevents a late paid request", async (t) => {
  const app = await setup(t),
    user = await app.session(),
    body = app.input();
  await app.call("job", { method: "DELETE", user, id: body.requestKey });
  const result = await app.call("generate", { method: "POST", user, body });
  assert.equal(result.data.status, "cancelled");
  assert.equal(app.starts(), 0);
});
test("cancel during submission cannot resurrect the result", async (t) => {
  let release, started;
  const began = new Promise((r) => (started = r)),
    pending = new Promise((r) => (release = r));
  const app = await setup(t, {
      provider: {
        start: async () => {
          started();
          await pending;
          return "provider-job";
        },
        status: async () => ({ status: "completed", image: imageData() }),
      },
    }),
    user = await app.session(),
    body = app.input();
  const generating = app.call("generate", { method: "POST", user, body });
  await began;
  await app.call("job", { method: "DELETE", user, id: body.requestKey });
  release();
  assert.equal((await generating).data.status, "cancelled");
  assert.equal(
    (await app.call("job", { user, id: body.requestKey })).status,
    410,
  );
});
test("hard global budget survives cancellations and new sessions", async (t) => {
  const app = await setup(t, { limits: { visitor: 5, ip: 10, daily: 1 } }),
    user = await app.session(),
    body = app.input();
  await app.call("generate", { method: "POST", user, body });
  await app.call("job", { method: "DELETE", user, id: body.requestKey });
  const next = await app.session();
  assert.equal(
    (
      await app.call("generate", {
        method: "POST",
        user: next,
        body: app.input(),
      })
    ).status,
    429,
  );
  assert.equal(app.starts(), 1);
});
test("unconfigured service advertises availability honestly and blocks paid generation", async (t) => {
  const app = await setup(t, { configured: false }),
    user = await app.session();
  assert.equal(user.data.configured, false);
  assert.equal(
    (await app.call("generate", { method: "POST", body: app.input() })).status,
    503,
  );
});
test("expired jobs do not call the provider again", async (t) => {
  const app = await setup(t),
    user = await app.session(),
    body = app.input();
  await app.call("generate", { method: "POST", user, body });
  app.advance(241000);
  assert.equal(
    (await app.call("job", { user, id: body.requestKey })).status,
    408,
  );
});
test("FASHN adapter sends real documented inputs and rejects an invalid result", async () => {
  const calls = [];
  const provider = fashnProvider("test-key", async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify(
        url.endsWith("/run")
          ? { id: "job-test" }
          : { status: "completed", output: ["not-an-image"] },
      ),
    );
  });
  assert.equal(await provider.start(imageData(), imageData()), "job-test");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model_name, "tryon-max");
  assert.equal(body.inputs.return_base64, true);
  assert.equal(body.inputs.num_images, 1);
  assert.match(body.inputs.prompt, /Preserve the person/);
  await assert.rejects(provider.status("job-test"), /could not be displayed/);
});