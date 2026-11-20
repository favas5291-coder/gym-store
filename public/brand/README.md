# GymDrobe brand assets

Use the green and cream GymDrobe wordmark for the favicon family, Apple touch icon, web app manifest, launcher icons, social profile artwork and homepage sharing image. Use a product photo for product-page sharing when one is available.

- `external/gymdrobe-app-icon-1024.png` is the production square wordmark master.
- `external/gymdrobe-maskable-512.png` keeps the full wordmark inside the web app icon safe area.
- `external/gymdrobe-profile-1024.png` is the square social profile export.
- `../gymdrobe-share-v2.png` is the 1200 × 630 homepage share image.
- Browser favicons use the initial from the approved wordmark. The ICO contains 16, 32 and 48 pixel frames. The 96 pixel PNG gives search engines a larger square version at a stable URL.
- The older black and orange SVGs are retained for references that already use their URLs. The build script reads the green and cream PNG master.

To regenerate just the browser icons, install Pillow and run `python scripts/generate-transparent-favicons.py --browser-only`. The same command without the flag also regenerates the launcher and share artwork. Run `node --test tests/favicon-assets.test.js tests/official-brand-identity.test.js` to check the output. The iOS AppIcon is stored separately under `ios/App/App/Assets.xcassets/AppIcon.appiconset`.
