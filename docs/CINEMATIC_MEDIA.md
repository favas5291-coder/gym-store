# GymDrobe campaign media

## Integrated flagship delivery assets — 27 October 2026

The current Higgsfield Seedance 2.5 films are generated editorial atmosphere, not filmed footage, product demonstrations or evidence of benefits. Separate landscape and portrait sequences show shoe preparation, a controlled curl and recovery. A portrait cleanup removes an unintended shirt symbol. Both web files are 11.79 seconds, muted, 24 fps, H.264/YUV420p, with fast-start metadata and a 0.4-second dissolve to the opening frame.

| Placement | Delivery file | Dimensions | Approximate size |
| --- | --- | --- | --- |
| Desktop film | `public/media/campaign/hero-desktop.mp4` | 1920 × 1080 | 1.3 MB |
| Portrait film | `public/media/campaign/hero-mobile.mp4` | 720 × 1280 | 936 KB |
| Desktop poster | `public/media/campaign/hero-desktop.webp` | 1920 × 1080 | 47 KB |
| Portrait poster | `public/media/campaign/hero-mobile.webp` | 900 × 1600 | 47 KB |

The manifest is `src/data/campaignMedia.js`. Replace these files at the same paths, or update the manifest and homepage poster preload paths in `index.html`. HTML supplies brand text, headings and links. Do not bake text or logos into the film. Collection photography comes from the real catalog. The 90 MB presenter advertisement at `src/assets/gymdrobe ad.mp4` is preserved as source; it is not imported or downloaded by the storefront.

The 700 px media switch requests one film. Normal visitors get an immediate muted inline autoplay attempt; reduced-motion and data-saver visitors get the poster with an explicit Play control. Pausing is preserved across scroll-away/return. Offscreen and hidden-tab playback pauses. Blocked or failed playback retains the poster and a manual retry. Mobile displays the complete portrait canvas within a dark frame, avoiding an additional crop of hands or shoes. Some source shots are intentional close-ups; the two variants are independent renders and are not frame-identical.

**Production asset still missing:** identifiable, currently available products photographed or generated from supplier-approved SKU/colour references. Current shoes, wardrobe and dumbbells are generic atmosphere and are not offered as product demonstrations. The final product insert can replace a short portion of the training sequence using Shot 3 below. Final brand review of generated anatomy, movement and continuity is still appropriate.

## Source masters, separate from public delivery

Source files remain available through Higgsfield. Retain these originals in the campaign/DAM workflow; do not repeatedly recompress web exports. Three generations in this redesign were quoted at 625 credits total (192 + 192 + 241); an ending account balance was not independently verified.

- Desktop: `5f097581-1e2b-4abd-82bc-0f274ef4a46c` — [source MP4](https://d8j0ntlcm91z4.cloudfront.net/user_3HOQTb2DeZm8porGiuaajml7EwH/hf_20261027_094005_5f097581-1e2b-4abd-82bc-0f274ef4a46c.mp4).
- Portrait original (superseded by cleanup): `f29b98d2-8962-438d-8fc1-9a82c2d1764e` — [source MP4](https://d8j0ntlcm91z4.cloudfront.net/user_3HOQTb2DeZm8porGiuaajml7EwH/hf_20261027_094005_f29b98d2-8962-438d-8fc1-9a82c2d1764e.mp4).
- Portrait cleanup: `3ae1197c-ebdc-44dd-9a6a-db9922d7fa7b` — [source MP4](https://d8j0ntlcm91z4.cloudfront.net/user_3HOQTb2DeZm8porGiuaajml7EwH/hf_20261027_142754_3ae1197c-ebdc-44dd-9a6a-db9922d7fa7b.mp4).

Earlier campaign versions are preserved in git history. The original individual shot prompts below remain the reference-guided production brief for a merchandise-accurate replacement, rather than a claim that the present films show those approved products.

## Reference pack needed for a product-accurate final cut

Supply full-resolution front, side, back and label photos for each approved in-stock SKU, plus its exact colour/variant. Include one lighting reference and one wardrobe/athlete continuity frame from the existing campaign. Obtain supplier approval for identifiable branding. Do not infer a reference from a product name or use a generated substitute. Never add certifications, endorsements or performance claims.

Generate each shot separately with handles, then assemble 0–3 / 3–6 / 6–9 / 9–12 seconds. Use image-to-video or reference-guided generation where references are supplied. Review each output before placing it in the final cut. The prompts below are independent and copy-ready once the named references are attached.

### Shot 1 — The preparation (0–3 seconds)

**References:** approved shoe and variant from multiple angles; athlete/wardrobe continuity frame; opening poster lighting reference.

```text
Create a 4-second shot, delivering a usable 3-second action plus edit handles. Photorealistic premium fitness commercial, modern dark gym, Indian athlete, natural anatomy and movement, realistic skin and fabric, tactile rubber and brushed-metal textures, dramatic controlled lighting, subtle atmospheric depth, restrained cinematic camera movement, premium commercial colour grading. Close-up of the athlete's hands tightening the training shoe in the attached approved product reference. Preserve its exact shape, sole profile, lace construction, fabric, colour and physical branding. Natural fingers, believable lace tension, no warping. Matte charcoal wardrobe, warm side light from camera right, deep neutral shadows, restrained grain. A very slow lateral camera drift. Begin with a composed, sharp frame suitable as a still poster. Desktop 16:9: keep the complete action inside the central 65%, with headroom and room for a narrow desktop panel. HTML headlines sit in a separate panel. No added words, graphics, captions or logos; retain only genuine markings on the referenced product. No invented claims or endorsement.
```

For the separate portrait render, replace the desktop framing sentence with: `Compose natively in 9:16. Keep the complete shoe and hands within the central 80%, with breathing room on all sides. Website text sits outside the footage. Do not crop a landscape export.`

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
