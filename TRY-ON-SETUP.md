# GymDrobe fitting room — setup and limits

Version 1.2 adds two connected tools on eligible product pages:

1. **See it on me:** photo upload/camera input, a real FASHN server integration, processing/error states, original/result comparison, an adjustable comparison slider, download and removal.
2. **Find my size:** body measurements in cm or inches, comparison with verified supplier ranges, clear reasons for a match/no match, stock-aware selection and application to the product’s size picker.

An attractive AI preview does not establish physical fit. It can change garment details, drape and body proportions. The generated image does not simulate a selected garment size. Measurement guidance is calculated separately and never changes the shopper’s body in the image.

## Run locally

Use the complete replacement project with Node.js 22.12 or newer:

```sh
npm ci
npm run dev:tryon
```

Or double-click `Start-GymDrobe.cmd` on Windows. This starts Vite on port 5173 and the try-on API on 127.0.0.1:3001. Keep the terminal open. Close any old development server first. `npm run dev` still starts just the storefront; use `dev:tryon` to run both services.

With the files as supplied, the fitting-room interface works but says photo generation is not yet available. There are no credentials, approved garment photos or fabricated supplier size charts included. The three activation steps below are required.

## 1. Connect the image provider

The integration uses **FASHN Try-On Max**, `quality` generation, `2k` resolution and one output per request. FASHN lists this endpoint as Preview; keep the integration under observation when their API changes. It supports clothing and shoes. A configurable `tryon-v1.6` alternative supports tops, bottoms and one-pieces only.

Create your own FASHN developer account, purchase API credits and create a key using their [API setup guide](https://docs.fashn.ai/getting-started/api-setup). Provider charges belong to your account. This package does not purchase credits or make paid test calls.

Copy `.env.example` to `.env` in the project root and enter your key:

```dotenv
FASHN_API_KEY=your_private_key_here
TRYON_MODEL=tryon-max
TRYON_PORT=3001
TRYON_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Keep the key in `.env` on the server. It must never use a `VITE_` prefix or appear in React code. `.env` is ignored by Git. Never send the key in a customer form. Restart the development process after changes. If you change the API port, also change the proxy target in `vite.config.js`.

## 2. Approve product reference photos

The original product photo files were not supplied. Copy those into `src/assets` for normal shopping. For try-on, prepare separate, sharp photos showing **one item in the exact selected colour**, without collages, labels or obscured panels. A clean background and clear fabric/print details matter. Include a full view of both shoes for footwear. Test each reference photo before exposing it to customers.

Place try-on reference photos in `src/assets/tryon`. Update `config/tryon-products.json`, for example:

```json
{
  "version": 1,
  "products": {
    "1": {
      "name": "Gym Training T-Shirt",
      "category": "tops",
      "enabled": true,
      "colors": {
        "Black": {
          "file": "src/assets/tryon/tshirt-black.jpg",
          "approved": true
        }
      }
    }
  }
}
```

Retain other product entries when editing the full file. Only set `approved` after checking the actual image. This server accepts JPEG/PNG references, at least 384 pixels on the shorter side and below 8 MB. A detailed 1,500–2,500 pixel source is a useful starting point. No automatic recolouring or fallback to a different colour is performed. A missing/invalid/unapproved image keeps that colour’s Generate button disabled.

The server resolves only approved local asset paths; customer requests cannot submit arbitrary product URLs. Server product configuration is separate from the device-local development catalogue editor.

## 3. Add supplier size measurements

Request this product’s **recommended body-measurement ranges** from the manufacturer, including the size system for shoes. Do not substitute a generic chart from another brand. Do not enter flat garment widths as body circumference. If only garment dimensions are available, obtain an appropriate body-size chart or a validated garment/ease model before enabling recommendations.

Edit `config/fit-charts.json`. The following is a schema template with `null` placeholders, **not real sizing data**. Replace every placeholder using the supplier chart, include every relevant size and change `verified` to true only after checking the data:

```json
{
  "version": 1,
  "products": {
    "1": {
      "verified": false,
      "source": "Supplier name and chart reference",
      "basis": "body",
      "unit": "cm",
      "requiredMeasurements": ["chest", "waist"],
      "sizes": [
        {"label": "S", "body": {"chest": [null, null], "waist": [null, null]}},
        {"label": "M", "body": {"chest": [null, null], "waist": [null, null]}},
        {"label": "L", "body": {"chest": [null, null], "waist": [null, null]}},
        {"label": "XL", "body": {"chest": [null, null], "waist": [null, null]}}
      ]
    }
  }
}
```

Supported measurement keys are `chest`, `waist`, `hips`, `shoulder`, `inseam`, `footLength` and `footWidth`. `unit` must be `cm` or `in`; every configured required measurement must have a minimum/maximum pair for every row. Size labels must match the product. Footwear charts can use `footLength` and `footWidth`; use the exact label/system supplied for the shoe.

The finder recommends only rows containing **all** supplied measurements. If several match, the customer’s closer/roomier preference ranks those matches. It does not fabricate measurements from a photo, body weight or height, and never recommends an unmatched larger size merely because it is available. Out-of-stock matches remain visible but cannot be selected.

The example ranges under `tests/fixtures` are synthetic test data. They are not imported by the default storefront and must not be used as supplier facts.

## Photo privacy and controls

- Choosing a file keeps it in component memory. No photo or body measurement is written to localStorage, sessionStorage, an account or the project filesystem.
- The browser checks type, size and minimum resolution, corrects supported image orientation, and re-encodes the photo to remove embedded metadata. It deliberately caps the longest side at 2,560 pixels to reduce upload size. These checks do not establish pose or image quality; the photo tips and provider validation still matter.
- A customer must check consent and click Generate before their prepared photo is sent. It is sent to GymDrobe’s server and then FASHN. Body measurements are not included.
- Base64 input/output avoids public customer-image URLs. FASHN’s documented retention applies: temporary input copies are removed after processing with a one-day cleanup backstop; base64 output remains retrievable for 60 minutes. Request records are retained under their policy and are not deleted by the local Remove button.
- The local server holds jobs/results only in memory, with 15-minute expiry. Completed jobs are removed from the server when the browser receives the result. The browser uses a revocable object URL for the result and clears its references when the dialog closes.
- Removing a photo or stopping the screen does not cancel a request already accepted by FASHN. The provider may finish processing it and provider billing may apply.
- Read the [provider retention policy](https://docs.fashn.ai/api-overview/data-retention-privacy). Configure your public privacy notice before launch.

## Server controls and production integration

The supplied launcher binds to localhost for setup. It is not an anonymous public paid-AI endpoint. It checks approved product/colour pairs, image bytes and dimensions, request size, exact Origin, CSRF token and job ownership. Cookies are HttpOnly/SameSite. Repeat submissions with the same request key reuse the job. Defaults cap a browser session at 5 attempts/hour, this process at 30/hour and 4 active jobs. A second active job for the same session is rejected. Rate-limit storage is memory-local; restarting resets it.

`server/tryon-server.mjs` exports `createTryOnServer`. To run publicly, call it from your backend with `production: true`, explicit HTTPS origins, and an `authorize(request)` function that validates your **server-side** customer session and returns a stable customer ID. The existing localStorage login is not that function. The production guard refuses startup without the authorization integration. For example, in a real backend:

```js
const api = createTryOnServer({
  catalog,
  apiKey: process.env.FASHN_API_KEY,
  model: "tryon-max",
  production: true,
  allowedOrigins: ["https://your-store.example"],
  authorize: async (request) => {
    const session = await yourSessionService.verifyRequest(request);
    return session?.customerId || null;
  }
});
```

`yourSessionService` is your backend integration, not a bundled function. Serve the frontend and `/api/try-on/*` on the same origin through HTTPS, preserving the public Host and Origin headers. Add shared per-customer/IP limits, persistent usage quotas and cost monitoring at your backend/gateway for multiple instances. Keep photos out of request logs and analytics. A static-only host cannot run the Node API; deploy it to a server environment and route the API path to it.

The rest of the shop remains the same browser-local commerce preview; this API does not turn payment, inventory or customer login into production services.

## Validation

```sh
npm run check
npm run test:tryon
```

The complete logic suite now includes 44 tests: the earlier 28 plus 16 try-on/fit/server tests. Optional browser tools:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:tryon:browser
npm run test:browser
```

The try-on browser suite uses the real local HTTP routes with an injected mock image provider and a labelled synthetic size chart/image. It tests privacy gates, comparison, errors, chosen size in the bag and responsive dialogs. **It does not measure live generation quality or validate actual garment fit.** No customer images, API credits or live credentials were available here.

Before opening the feature to customers, test the live provider with permissioned photos across your actual garments, colours, sizes, poses and body shapes; compare the size recommendations with real try-ons. Record failures and keep items disabled when results are unreliable. A photo-generation service cannot guarantee a perfect fit.

## Provider references checked for this implementation

- [Try-On Max request fields and lifecycle](https://docs.fashn.ai/api-reference/tryon-max)
- [Try-On v1.6 alternative](https://docs.fashn.ai/api-reference/tryon-v1-6)
- [Authentication, job status and errors](https://docs.fashn.ai/api-overview/api-fundamentals)
- [Image preprocessing](https://docs.fashn.ai/guides/image-preprocessing-best-practices)
- [Account and API setup](https://docs.fashn.ai/getting-started/api-setup)

Implementation checked on 27 September 2026. Recheck the provider documentation when upgrading or launching.