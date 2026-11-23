# Changelog

## 2026-11-23 - Deployment, landing, and public docs

- Deployed Ciro to QDay Aevum testnet (chain 44005) at `0x4AceB37ecAce160B4363111460020c2d088C529C`, settling in tUSD8 with a zero fee. The README links the deploy, an exact pay, and a refused name on the explorer.
- The landing hero is centered, with the app preview (a real screen recording) below on a framed backdrop, and a five-photo slideshow with progress dots.
- The in-app faucet routes to the official QDay faucet on Aevum; on a local test chain it still mints.
- Moved internal operations docs (handoff, status, decisions, research, roadmap, hackathon, tasks) to a private repo. The public tree keeps the README and the judge-facing docs.

## 2026-11-23 - Landing unslop pass

- The landing hero is now the split UX.md asks for: copy and two actions on the left, a live name-check card on the right. The card types "Ada Okonkwo", shows exact, close, or none with the same fold rule the API uses, and reveals the pay button only on exact. `e2e/public.test.js` now asserts that a capital and a double space still pay and that another name does not.
- Removed the violet-to-teal radial wallpaper, the noise overlay, and the large colored shadow behind the app preview. The preview sits on the quiet rail panel with a hairline.
- Removed the auto-playing demo video. The file recorded the landing page itself, so the preview showed Ciro inside Ciro. The drawn dashboard preview stands alone until a real recording exists.
- The three steps use line icons from the app's own set instead of the three Fluent 3D PNGs.
- The why-the-name section is one credited photo instead of a five-photo auto-rotating carousel.
- Section heads, steps, FAQ, build cards, and the lookup card share one left edge instead of alternating centered and left.
- `[ bracket ]` labels are sentence case with no wide tracking, and small labels no longer carry negative tracking.
- Deed corner ticks now mark only the invoice, pay, and receipt cards. Other cards are hairline boxes.
- Fixed the header's How it works and FAQ links. They now render the landing and scroll to the section instead of re-rendering the page and staying put.
- Mobile: How it works and FAQ leave the bar below 640px, so Docs and Open app keep their room.

## 2026-11-22

- Public pages: the landing now has the asymmetric hero split (name-check card on the right), the app-preview placeholder, the three steps with Fluent 3D icons, the why-split with a photo, the FAQ, the docs teaser, and the invoice lookup. `#/docs` is the new public docs page: API, CLI, MCP, contract addresses, network, add-network and faucet actions.
- Motion: one easing curve, hover lifts, link underlines, fades on navigation. No loops except the text caret. `prefers-reduced-motion` renders the final state.
- New walk between the wallet and the chain: the web app asks the wallet to switch to the Ciro chain before signing, and adds the chain first if the wallet says 4902. Every signed transaction carries the chain id. A wallet on mainnet now gets Aevum gas quotes instead of mainnet ones.
- The pay screen offers the test faucet (1,000 tUSD8) when the wallet lacks the token.
- Fonts: General Sans (Fontshare, free) is now the loaded face, self-hosted in `web/public/fonts/`, standing in for Neue Montreal until the licensed files arrive. The exact target file names stay documented in `docs/design/UX.md`.
- Screen recording: the landing preview is video-ready. `node scripts/record-demo.mjs` records a real click-through on a local fixture to `web/public/media/ciro-demo.webm`, which auto-plays over the drawn preview. Reduced-motion keeps the still preview.
- Referenced spicenet.io as a second design reference. It is a warm paper theme (cream `#EDE7E3`, red `#EA4B4B`, Inter), so the Maren white/violet direction is kept and Spicenet is noted only for structure.
- Removed unused StockSnap photo. Docs reworked: landing structure, motion rules, font reality, docs page, faucet, add network, recording script.

## 2026-11-21 — Web app

- Rebuilt `web/` to the Maren Finance design system (www.marenfinance.xyz, the extracted DESIGN.md): white canvas, near-black ink, the violet accent for interactive moments, sharp 0px corners, hairline borders, tight display tracking, generous whitespace.
- Micro-interactions: hover color shifts on links and buttons, the active `scale(1.08)` on the primary button, focus outlines, and a fade on navigation. No gradients, no shadows, no animated backgrounds.
- Copy rewritten for people: short sentences, no marketing words, no em or en dashes in any visible text.
- Added `favicon.svg`.
- The History screen draws from the invoice list the app already has, so the pay-flow e2e can read it right after the navigation. The payer receipts section fills in when that read lands.

## 2026-11-21

- Renamed the product from Chirograph to Ciro. Chiro was rejected because it collides with chiropractic.
- Reorganized documentation under `docs/product`, `docs/design`, `docs/architecture`, `docs/security`, `docs/development`, and `docs/operations`.
- Added the documentation index, changelog, and threat model.
- The sentence above was true when the docs were first reorganized. The backend landed later the same day. See the entry below.

## 2026-11-21 — Backend

- Added `contracts/src/Ciro.sol` and `MockUSD8.sol`. `forge test`: 11 passed. Shanghai, solc 0.8.28. The product field reference is stored as `memo` because `reference` is a reserved word. The revoked-allowance revert is `AllowanceIsRevoked` so it does not collide with the `AllowanceRevoked` event.
- Added `packages/api`, `packages/cli`, and `packages/mcp`. The API returns unsigned transactions. The CLI signs with a mode-0600 key file and refuses a close name before it signs. MCP prepares and does not sign.
- `npm test` at the repo root passed. It runs the shared unit tests, then the API, CLI, and MCP packages. The API and CLI tests use Anvil's published development accounts. Those keys are not a deploy key and are not written here.
- No web app. No Aevum deployment. No private key was created.
