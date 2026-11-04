# GymDrobe branding usage

## Inside the website and app
Keep the previous GYMDROBE text wordmark in the navigation, footer, account, checkout, and other existing shopping UI. Keep the original in-app colors, layout, typography, loading screens, and Android splash artwork. Do not replace these elements with the new premium external icon.

## Outside the website and app
Use the approved black, white and orange icon only for browser favicons, Apple touch icon, PWA and Android launcher artwork, public social profile images, and brand-focused share previews. Use product photographs for individual product sharing when available.

- `gymdrobe-app-icon.svg`: reconstructed full square artwork used as the external identity source.
- `gymdrobe-lockup.svg`: reconstructed external white lettering and orange underline; **not** for storefront navigation/footer.
- `external/gymdrobe-app-icon-1024.png`: export for external icon artwork, not an iOS asset catalog.
- `external/gymdrobe-maskable-512.png`: safe-zone PWA launch artwork.
- `external/gymdrobe-profile-1024.png`: external social-profile artwork.
- `../gymdrobe-share-v2.png`: homepage/brand share preview.

The SVGs are careful reconstructions from the approved mockup, **not** source master artwork. A full-wordmark favicon may be unreadable at 16/32 px; visually inspect actual device sizes before release.

## Reproducing the external assets
From the repository root, install the free image dependencies and run:

```bash
python -m pip install pillow cairosvg
python scripts/generate-transparent-favicons.py
node --test tests/favicon-assets.test.js tests/official-brand-identity.test.js
```

The generator writes the external PNG/ICO files and Android launcher mipmaps only. It does **not** modify internal components or Android splash files. GitHub Actions checks these outputs without pushing new commits.

## Deployment and third-party platforms
A changed GitHub branch does not update the live website or installed native apps by itself. Review checks before merging and deploying. This repository contains Android resources; an iOS native project was not established in the audit. App Store/Play Store listing changes, social accounts, Google Search recrawling, and Google Business Profile require separate external account steps.
