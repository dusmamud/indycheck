# indycheck website

Public website for **indycheck** — the offline Indian ID validator (PAN, Aadhaar, GSTIN, IFSC, UPI, mobile, PIN code, TAN, CIN, LLPIN, Voter ID, vehicle). Built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build). Fully static: no SSR, no backend, no database.

Live at **https://indycheck.pages.dev** — auto-deployed from `main` by the Website workflow (build, then deploy to Cloudflare Pages) whenever `website/` changes.

## Run it

```bash
npm install
npm run dev      # local dev server at http://localhost:4321
npm run build    # production build into ./dist/
npm run preview  # preview the production build locally
```

Requires Node 18+ (developed with Node 24).

## What's here

| Path | What it is |
| --- | --- |
| `src/pages/index.astro` | Landing page — hero, install commands, live mini-validator demo (pure JS, no WASM), 12-ID table, error-code preview |
| `src/pages/playground.astro` | In-browser playground — all 12 validators, options panel (strict/lenient, spaces/hyphens, +91), test-data generator, presets, shareable `?type=…&value=…` URLs. WASM is lazy-loaded **only here** |
| `src/content/docs/` | Starlight docs: getting-started, one page per validator (12), options, error codes, masking & formatting, generators, API, integrations (Zod/RHF/Yup/Pydantic), CLI, FAQ, contributing |
| `src/lib/validator.js` | Pure-JS implementation of the validation rules (Verhoeff, Mod-36 Luhn), options, mask/format helpers, test-data generators and `detect()` — used by the landing demo and as the playground fallback until the WASM build lands |
| `public/og.svg`, `public/favicon.svg` | Social card + favicon |
| `astro.config.mjs` | Site URL, Starlight sidebar, sitemap, OG meta, JSON-LD |

## How the playground's WASM works

The WASM build (`crates/indycheck-wasm/pkg/`, built with wasm-pack) does **not** exist yet. Until it does:

- The playground tries a lazy dynamic `import('/wasm/indycheck_wasm.js')` on first validation, catches the failure, and falls back to `src/lib/validator.js` — same rules, real validation, never faked results.
- The landing page never loads WASM at all.
- Once the WASM package is built, copy its `pkg/` output into `public/wasm/` and the playground picks it up automatically (see the `TODO` in `src/pages/playground.astro`).

## Docs

Docs are in English for v0.2.1; the error messages in the package itself are bilingual (`reason_en` + `reason_hi`). Every doc page carries the honest-limits note: indycheck checks **format and checksum only** — it never verifies that an ID exists or belongs to anyone, and it never contacts UIDAI, NSDL, GSTN, MCA, ECI or any bank. TAN, CIN, LLPIN, Voter ID and vehicle numbers have no public checksum — format only.

## Notes

- Do not commit real personal data (real PAN/Aadhaar/GSTIN/mobile numbers) anywhere in this repo. Test values are synthetic, e.g. `AAAPL1234C`, `234567890124`.
- The `dist/` build output is git-ignored; the Website workflow deploys it to Cloudflare Pages.
