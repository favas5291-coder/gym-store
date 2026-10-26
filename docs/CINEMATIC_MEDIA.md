# GymDrobe campaign media

## Integrated delivery assets

The two Higgsfield Seedance 2.5 films are generated editorial atmosphere, not product demonstrations or evidence of product benefits. They share wardrobe, gym, athlete and lighting. A second edit removed unintended lettering and chest marks. The last 0.7 seconds dissolve to the opening frame. Each web loop is 11.79 seconds, muted, 24 fps, H.264/YUV420p with fast-start metadata.

| Placement | Delivery file | Dimensions | Approximate size |
| --- | --- | --- | --- |
| Desktop film | `public/media/campaign/hero-desktop.mp4` | 1920 × 1080 | 2.48 MB |
| Portrait film | `public/media/campaign/hero-mobile.mp4` | 720 × 1280 | 1.21 MB |
| Desktop poster | `public/media/campaign/hero-desktop.webp` | 1920 × 1080 | 55 KB |
| Portrait poster | `public/media/campaign/hero-mobile.webp` | 900 × 1600 | 45 KB |
| Editorial still | `public/media/campaign/editorial.webp` | 1200 × 675 | See file |

The manifest is `src/data/campaignMedia.js`. Replace these files at the same paths, or update that manifest. HTML supplies all brand text, headings and links. Do not bake text or logos into the campaign film. Product photography and collection thumbnails continue to come from the catalog.

**Production asset still missing:** the 6–9 second insert of identifiable, currently available products with supplier-approved references. The current film uses a neutral dumbbell/rubber-floor detail in that slot. It is a clearly documented temporary campaign insert, not a representation of a purchasable SKU. The generated shoes and wardrobe are also generic atmosphere. Check the complete film for anatomy, continuity, unidentified marks and mobile framing before final brand approval.

## Source masters, separate from public delivery

Keep source masters in a campaign/DAM folder, not `public`. Retain original frame rates and resolution; do not repeatedly recompress the web exports. Higgsfield generation records and source downloads:

- Desktop original: `497789d0-9d2e-4bdf-8f7d-6b54e0fb97bf`.
- Portrait original: `a08ccaf1-3684-436c-b40a-df5a51fa0cce`.
- Desktop cleanup: `d94058f2-1dae-4574-a410-bdcfc6be60c4` — [source MP4](https://d8j0ntlcm91z4.cloudfront.net/user_3HOQTb2DeZm8porGiuaajml7EwH/hf_20261026_132829_d94058f2-1dae-4574-a410-bdcfc6be60c4.mp4).
- Portrait cleanup: `6a6a8f9e-5356-43e7-bb84-cc2e34250b2e` — [source MP4](https://d8j0ntlcm91z4.cloudfront.net/user_3HOQTb2DeZm8porGiuaajml7EwH/hf_20261026_133330_6a6a8f9e-5356-43e7-bb84-cc2e34250b2e.mp4).

## Reference pack needed for a product-accurate final cut

Supply full-resolution front, side, back and label photos for each approved in-stock SKU, plus its exact colour/variant. Include one lighting reference and one wardrobe/athlete continuity frame from the existing campaign. Obtain supplier approval for identifiable branding. Do not infer a reference from a product name or use a generated substitute. Never add certifications, endorsements or performance claims.

Generate each shot separately with handles, then assemble 0–3 / 3–6 / 6–9 / 9–12 seconds. Use image-to-video or reference-guided generation where references are supplied. Review each output before placing it in the final cut. The prompts below are independent and copy-ready once the named references are attached.

### Shot 1 — The preparation (0–3 seconds)

**References:** approved shoe and variant from multiple angles; athlete/wardrobe continuity frame; opening poster lighting reference.

```text
Create a 4-second shot, delivering a usable 3-second action plus edit handles. Photorealistic premium fitness commercial, modern dark gym, Indian athlete, natural anatomy and movement, realistic skin and fabric, tactile rubber and brushed-metal textures, dramatic controlled lighting, subtle atmospheric depth, restrained cinematic camera movement, premium commercial colour grading. Close-up of the athlete's hands tightening the training shoe in the attached approved product reference. Preserve its exact shape, sole profile, lace construction, fabric, colour and physical branding. Natural fingers, believable lace tension, no warping. Matte charcoal wardrobe, warm side light from camera right, deep neutral shadows, restrained grain. A very slow lateral camera drift. Begin with a composed, sharp frame suitable as a still poster. Desktop 16:9: action on the right with quiet negative space on the left for HTML headlines. No added words, graphics, captions or logos; retain only genuine markings on the referenced product. No invented claims or endorsement.
```

For the separate portrait render, replace the desktop framing sentence with: `Compose natively in 9:16. Keep the shoe and hands within the central 80% and upper 60%; leave the lower 40% quiet enough for HTML text. Do not crop a landscape export.`

### Shot 2 — The grip (3–6 seconds)

**References:** shot 1 continuity frame; approved dumbbell photos if it represents merchandise. Otherwise use a plain unbranded gym prop with no implied SKU.

```text
Create a 4-second shot with a clean 3-second action and edit handles. Photorealistic premium fitness commercial, modern dark gym, Indian athlete, natural anatomy and movement, realistic skin and fabric, tactile rubber and brushed-metal textures, dramatic controlled lighting, subtle atmospheric depth, restrained cinematic camera movement, premium commercial colour grading. Match the athlete, wardrobe, gym, side lighting and neutral charcoal grade in the attached continuity frame. Macro view of one hand closing calmly around a dumbbell's knurled metal grip. Five anatomically correct fingers, natural skin compression and tendons, realistic weight and contact. One controlled grip, no impossible lift or extra fingers. Tiny camera push, stable focus on skin and metal. Preserve all details of an attached approved equipment reference; otherwise use an unbranded gym prop. Desktop 16:9 with action on the right and quiet space left. No text, invented symbols, extra logos, endorsements or benefit claims.
```

Portrait instruction: `Recompose in 9:16 with the complete gripping hand and both ends of the grip visible in the upper two-thirds. Keep lower text space and consistent lighting.`

### Shot 3 — The essentials (6–9 seconds; outstanding)

**References required:** two or three actual in-stock products, exact variants and full-resolution supplier-approved photos; category and SKU list for review. Do not submit without those references.

```text
Create a 4-second product-tableau shot with a usable 3-second center and edit handles. Photorealistic premium fitness commercial, modern dark gym, natural materials, tactile rubber and brushed-metal textures, dramatic controlled lighting, subtle atmospheric depth, restrained cinematic camera movement, premium commercial colour grading. Arrange only the exact approved products attached as references on a low brushed-metal bench above dark rubber flooring. Preserve every product's true proportions, geometry, colour, seams, material finish, labels and logos. Do not invent additional merchandise. Use the same warm right-side key light and deep neutral shadows as the attached campaign continuity frame. Slow, minimal slider move; products remain stationary, grounded and sharply legible. Desktop 16:9: products occupy the right two-thirds, leaving quiet left space for HTML. No floating objects, morphing, extra writing, generated logo overlays, certifications, endorsements or claims. If a reference detail cannot be retained, keep the view simple instead of inventing it.
```

Portrait instruction: `Create a separate 9:16 arrangement with the products at different heights, wholly visible in the center and upper two-thirds. Preserve proportions and leave the lower third quiet. Do not merely crop the landscape shot.`

### Shot 4 — Ready for the next rep (9–12 seconds)

**References:** athlete/wardrobe/lighting continuity frame, shot 1 opening frame as ending reference.

```text
Create a 4-second closing shot with edit handles. Photorealistic premium fitness commercial, modern dark gym, Indian athlete, natural anatomy and movement, realistic skin and fabric, tactile rubber and brushed-metal textures, dramatic controlled lighting, subtle atmospheric depth, restrained cinematic camera movement, premium commercial colour grading. Same athlete and plain charcoal wardrobe as the attached continuity frame. A confident, composed pause after a set: relaxed shoulders, controlled breathing, natural expression, no exaggerated strain. Keep the whole head visible with 12% headroom. Warm side light from camera right, no neon or spectacle. Minimal camera movement. End with a slow downward visual transition toward the shoe preparation composition in the attached opening frame, suitable for a gentle seamless loop. Desktop 16:9 with athlete on the right and negative space left. No additional logos, words, captions, endorsements or benefit claims.
```

Portrait instruction: `Recompose in 9:16; keep the full head, hands and intended equipment visible within the safe center area, face in the upper middle, lower 40% quiet for HTML. Match the portrait opening frame at the ending.`

## Finishing and export

- Master: retain highest available quality, 24 fps, colour-managed SDR/Rec.709. Aim for 3840 × 2160 landscape and 2160 × 3840 portrait when the source supports it; never present an upscaled file as native 4K. Current sources are 1080p.
- Edit: 10–12 seconds total; controlled cuts or short dissolves; match exposure and white balance. Inspect frame-by-frame for fingers, laces, product geometry, text/label drift and identity continuity. Keep the closing transition gentle.
- Web: MP4/H.264, YUV420p, no audio track, fast-start, 24 fps, 1080p desktop and 720 × 1280 portrait. Start at CRF 25, inspect detail and adjust. Optional WebM only if it saves enough bytes and is explicitly implemented.
- Posters: export the exact opening frame as WebP, 1920 × 1080 and 900 × 1600; target under 120 KB each. Keep the first frame beautiful without relying on motion.
- Browser: preserve the existing responsive manifest, 700 px switch, muted inline playback, pause/retry control, offscreen pause and reduced-motion/data-saver behavior. Re-run `npm run test:storefront` after replacing assets.
