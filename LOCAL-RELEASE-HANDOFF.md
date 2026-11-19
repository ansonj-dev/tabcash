# TabCash local release handoff

2026-11-19 UTC. This is a local review artifact. Nothing has been hosted, submitted, messaged or transacted by this work.

## Prepared artifact

Latest validated preview ZIP:

`release/tabcash-PREVIEW-2026-11-19T08-22-18-148Z.zip` (SHA-256 `21420505c27739c477d2a5251afcabedc0b167e4b5df264c49caf39b8162e3`)

Inside its single top-level folder:

- `site/`: complete static browser build, including `judge-guide.html`.
- `HANDOFF.txt`: upload instructions and accurate missing-field status.
- `manifest.json`: SHA-256 and byte length for each packaged file, with `mode: local-preview`, `publicConfigurationValid: false` and `externalEvidenceVerified: false`.

Only `site/` contents belong on the chosen HTTPS static host, served from the domain root. Dependencies, source, decks and signing material are not included in this archive. The source repository and prepared local Widget Factory deck need their own public links.

The browser banner now uses the same public-config validator as release checks. Invalid links remain plain text; the voting address must be a checksummed mainnet token-aware address with a supported payment-script payload. Local format checks never establish link accessibility, address ownership, event eligibility or chain evidence.

## Validation performed

All commands below ran in `00-bchblaze-main` with Node v24.21.0.

| Command/check | Result |
|---|---|
| `npm run package:preview` | Exit 0. Runs tests, builds production client and packages a fresh timestamped ZIP. Latest regeneration includes the WizardConnect compatibility fix and supersedes the earlier preview. |
| `npm test` | Final 15/15 passed repeatedly, including six real-package change-allocation/API regressions. Covers ledger conservation/imports, immutable payment fields, public URL rules, voting-address checks and blank/complete config states. |
| `npm run build` (inside packaging) | Exit 0. Vite 8.3.8, 344 modules, final JS 785.97 kB / gzip 299.33 kB. Existing non-fatal >500 kB chunk warning remains. |
| `npm run smoke:release` | Exit 0 twice. Temporarily serves the production build on loopback port 14100; index, both bundled assets and judge guide return correctly; child server stopped. |
| ZIP manifest inspection | Latest ZIP: all 5 packaged file hashes/sizes match the manifest; preview flags are correct; guide is included. |
| `npm run check:submission` | Expected exit 1: published talk/deck URL, repository URL and voting address are blank. |
| `npm run package:release` | Expected exit 1 at strict configuration check after tests pass; no release-candidate ZIP created. |

A new negative case initially caught acceptance of a checksummed 24-byte token P2PKH payload. The validator was fixed to require supported P2PKH/P2SH payload lengths; final tests and build passed. HTTP checks establish local files are served, not visual browser QA or actual wallet interoperability.

## Remaining participant actions

1. Publish the prepared short Widget Factory talk/deck and actual source repository, then put their real HTTPS URLs in `submission.js`. Independently open them without relying on a logged-in session.
2. Supply the participant's own token-enabled BCH mainnet address for EMBER2026 voting. Verify it in the wallet; do not enter keys or seed phrases.
3. Run `npm run check:submission`, then `npm run package:release`. A passing result means required public formats are present; it still does not establish external evidence.
4. Choose/provision the HTTPS host and publish only `site/` contents at the root. Open the real hosted URL and verify banner links, voting address, layout, keyboard use, export/import, relay/Electrum connectivity and wallet compatibility. No account or host has been selected here.
5. Rehearse the bundled two-minute guide with fictional expenses first. Then, only if the participant chooses to authorize real funds, demonstrate a useful small mainnet settlement through a compatible WizardConnect HD wallet, inspect the exact recipient/amount/fee/change, retain actual txid and independent confirmation evidence, and manually record the confirmed settlement. An unknown broadcast outcome requires inspection before retrying.
6. Verify registration/stream-roll-call status and organizer handling of late participation, complete or verify Telegram confirmation, record the short demo and make the final entry/submission actions. This handoff cannot confirm these account or organizer gates.

Local script inventory: `check:local` reports config without a failing exit code; `check:submission` is strict; `package:preview` allows missing participant fields and labels the archive accordingly; `package:release` blocks them; `smoke:release` checks the built HTTP assets. ZIP creation uses Windows PowerShell `Compress-Archive`; non-Windows packaging currently leaves a prepared release folder instead.

## Change-allocation compatibility update

The newest preview removes the nonexistent dapp 0.2.8 allocation-method calls. Change selection is now app-owned, persisted per hashed wallet identity and serialized with Web Locks; it checks server history and stays within indices 0–19. Reservations survive cancellation and ambiguous outcomes. [CHANGE-POLICY.md](CHANGE-POLICY.md) documents failure conditions and live browser/wallet checks still required. No real signature or transaction was performed.
