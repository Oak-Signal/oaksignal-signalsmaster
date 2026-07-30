---
version: "0.1.0"
date: "2026-02-11"
title: "Upgrade Flag Assets to SVGs"
stage: "Pre Alpha"
category: "feature"
---


### Changed
- Replaced all 26 alphabet flag images with SVG versions in `flag-letters`, ensuring crisp scaling on retina displays and mobile devices.
- Replaced Number and Pennant flag images with SVG equivalents.
- Reduced overall asset file size by migrating from raster (PNG) to vector (SVG) format.

### Fixed
- Reviewed and corrected flag meanings and descriptions to ensure accuracy in the Reference Guide.
- Front-end Reference Guide now renders all flags without blurring on high-DPI screens.

### Internal
- Updated `letters.ts`, `numbers.ts`, and `special.ts` seed files to reference `.svg` paths instead of `.png`.
- Re-seeded the database via `npx convex run seed_flags:seedFlags`, updating live `imagePath` fields.
- Verified updated records against the Convex dashboard to confirm successful migration.