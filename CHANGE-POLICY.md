# WizardConnect change allocation compatibility fix

2026-11-19 UTC. The installed `@wizardconnect/dapp` 0.2.8 exposes `getSessionPaths()` and `getPubkey()` but does not expose the `getIndexToUse()` / `setAddressIndex()` methods previously called by `wallet.js`. Those calls have been removed.

`change-policy.js` now owns bounded change reservation:

1. Identify the shared `change` xpub using the real manager API and hash it for a local storage/lock key. Neither the raw xpub nor any signing key is persisted by this policy.
2. Acquire an exclusive Web Lock for that wallet on this origin. Other tabs using the same app/profile/origin must wait rather than reserve the same index concurrently.
3. Consider only change indices 0–19, matching the existing funding scan. Skip locally reserved indices; derive candidates through `getPubkey(1, index)` and ask the fixed mainnet Electrum provider for their script history.
4. Refuse unknown/malformed history. Reserve a candidate only when that server reports no history. Persist and read back the reservation before constructing the wallet request. A changed wallet path, corrupt state or failed persistence stops the flow.
5. Retain reservations after cancellation, signing errors or unknown broadcast outcomes. If all 20 candidates are reserved or have history, stop the bounded demo rather than silently reuse or derive beyond its recovery scan.

A secure browser context with Web Locks and working local storage is required. There is no unsafe fallback. Web Locks coordinate this origin's participating tabs, not other wallets, browser profiles, devices or origins. One server's empty history does not prove an address has never been used; use a dedicated small demo wallet and avoid concurrent external wallet activity. Clearing browser storage loses reservations and saved payment records; inspect and preserve evidence before any such reset.

This changes public-key selection only. Mainnet consent, recipient/amount/fee confirmation, the actual wallet signing request with `broadcast:false`, signed transaction field validation, and saving the txid before broadcast remain in place. No test or build invokes a real wallet signature or transaction send.

## Validation

- `npm test`: 15/15 passed repeatedly. Six new tests use the actual installed `DappConnectionManager` with locally restored deterministic public paths and mocked history/storage. They cover manager recreation, prior history, serialized concurrent allocation, independent wallet identities, unavailable history, failed persistence, corrupt/exhausted records and wallet-path changes. They create no relay or external request.
- `npm run package:preview`: tests pass, production Vite build passes, fresh ZIP prepared. Final JS 785.97 kB / gzip 299.33 kB; existing non-fatal >500 kB chunk warning remains.
- `npm run smoke:release`: local production index, both assets and judge guide pass; child server stopped.
- `npm run check:submission`: expected exit 1 for missing published talk/deck URL, repository URL and token-enabled mainnet voting address.
- Latest preview: `release/tabcash-PREVIEW-2026-11-19T08-06-04-097Z.zip`. It supersedes the earlier preview containing the unsupported API calls. Archive manifest SHA-256/size inspection passes.

Actual pairing, browser Web Locks behavior with two live tabs, wallet interoperability and mainnet transfer evidence remain participant validation steps. No publication, deployment, funded signature or transaction was performed.
