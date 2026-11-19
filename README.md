# TabCash

TabCash is an original shared expense tab for the BCH BLAZE 2026 general hackathon. Split costs in integer satoshis, reduce paybacks to a compact settlement plan, and pay recipients directly from an HD wallet through WizardConnect. Keys stay in the wallet.

## Run and deploy

Requires Node 24. Run `npm ci`, then `npm run dev`, and open http://localhost:4100. Opening index.html directly is no longer sufficient because wallet dependencies are bundled through Vite. `npm run build` produces `dist/`; `npm run preview` serves that build locally. Deploy the contents of `dist/` to an HTTPS static host. No backend, API key or private key is needed. Public Nostr relays carry encrypted WizardConnect traffic; the CashScript mainnet Electrum provider supplies UTXOs and transaction broadcast. Those services must be reachable by the user's browser.

The production bundle compiled successfully. Offline regression tests now cover integer splitting, settlement conservation, imported-state validation and exact signed-payment preservation. Real wallet pairing, blockchain transfer and deployment remain unverified.

## Demonstration

1. Inspect the preloaded Austin tab and the settlement plan. Integer satoshi splits allocate remainder deterministically. The greedy matching algorithm reduces transfers; it does not guarantee a globally minimal transfer count for every possible balance set.
2. Click a person's name in the People panel (or focus it and press Enter) to add or edit a full `bitcoincash:` recipient address. New people can also be added with an address. Sample members have no address until supplied.
3. Click Connect wallet and Start new pairing. Scan the generated QR from a compatible WizardConnect **HD** wallet, or copy its URI into the wallet. Select BCH mainnet in the wallet. The UI shows the first derived mainnet receive address. No BCH seed/private key is requested, and session credentials are not persisted.
4. Fund that wallet with a small amount of mainnet BCH. The demo scans only the first 20 receive and first 20 change addresses and chooses one sufficiently funded BCH-only UTXO. If an existing wallet has funds beyond that range, use the displayed receive index 0 address. CashToken UTXOs are excluded.
5. Read and select the real-mainnet acknowledgement. Open the settlement plan and choose Pay with connected wallet for the intended payback. The connected wallet is the payer, so only approve transfers you intend to fund. Each send is capped at 0.01 BCH, with a minimum of 546 sats, a fixed 1,000 sat miner fee, and change returned to the wallet's change path.
6. Confirm the recipient, exact amount, fee and change in the app, then inspect and approve in the wallet. A signature request uses `broadcast:false`; TabCash checks that the returned transaction preserves inputs/outputs and amounts before it broadcasts through the mainnet provider. Cancel signing is available in the wallet panel.
7. A successful broadcast displays the actual transaction ID/explorer link and stores a pending payment record locally. It **does not** change expense balances or claim block confirmation. Check the transaction in your wallet or explorer, then use Record confirmed payment manually. This records the participant's confirmation; it is not automatic chain verification. Duplicate sends for the same pending from/to/amount tuple are blocked locally. Local data may be exported; clearing browser storage removes those records.
8. Export the tab, then import it in another browser to show portability. Imports and expense records are local application data, not signed shared state.

## Submission setup still required

The banner at the top deliberately shows missing public fields. Edit `submission.js` before publishing:

- `widgetFactorySlideUrl`: public link to the organiser-required Widget Factory slide.
- `sourceRepositoryUrl`: public source repository for this entry.
- `ember2026DonationAddress`: your actual CashTokens-enabled BCH address for EMBER2026 donations. It is not a BCH-only address alias; obtain the token-enabled address from your wallet.

The participant must supply the real wallet and address, approve any funded transaction, publish a live demo and repository, publish the prepared local deck and paste its public link, and complete or verify the organiser's entry/stream-attendance/roll-call/Telegram status. No placeholder is represented as completed evidence. The mainnet-track wallet integration is implemented, but eligibility and a successful recorded live transaction are still pending. No submission, deployment, donation or message to organisers has been sent.

## Architecture and limits

`app.js` owns exact expense arithmetic and local tab history. `wallet.js` uses the official `@wizardconnect/core` relay and `@wizardconnect/dapp` connection manager. HD xpubs derive public receive/change addresses through libauth. CashScript builds a one-input, two-output BCH transaction with a placeholder unlocker; WizardConnect asks the wallet to sign it using an explicit input path. The app validates the returned transaction's immutable fields, then broadcasts it. Signing authorization remains in the wallet; it is not custody.

Settlement confirmation is manual. There is no payment watcher, signed tab synchronization, conflict resolution or automatic reorganisation handling. The wallet protocol shares HD public paths with this app, which allows address discovery and affects wallet privacy; it does not disclose spending keys. Use a dedicated small demo wallet when recording the hackathon flow. Token transfers and token donation sending are outside the settlement feature. Public submission configuration is not secret storage.

## Primary references

- Official WizardConnect integration: https://docs.riftenlabs.com/wizardconnect/dapp/
- Protocol and signing: https://docs.riftenlabs.com/wizardconnect/protocol/
- HD public derivation: https://docs.riftenlabs.com/wizardconnect/pubkey-derivation/
- CashScript transaction API: https://cashscript.org/docs/sdk/transactions
- Official event: https://dorahacks.io/hackathon/bchblaze2026/detail

All application source is original. Dependencies retain their own licenses; WizardConnect is linked as an npm dependency under LGPL-3.0-or-later and has not been modified.

## Guided start and transaction observations

An accessible, collapsible first-run walkthrough now identifies the Austin entries as fictional expenses, links to the expense and payback dialogs, explains address editing, and distinguishes live payments from local sample math. Keyboard focus indicators cover buttons, links, summaries and editable person rows.

The actual signed transaction ID is persisted **before** broadcast. If the broadcast response is interrupted, the saved ID keeps the transfer from being silently treated as unsent; inspect the wallet/explorer before any retry. A saved ID alone does not prove that the network accepted or confirmed the transaction. Local duplicate protection remains in place until the tab is explicitly reconciled; no automatic retransmission is attempted.

For saved transactions, **Read transaction status** makes a read-only verbose Electrum lookup and stores the observation time. When a server returns an explicit confirmation count, the UI labels it as that server's report. An unsupported/failed query remains unknown and never becomes a claim of rejection or zero confirmations. These observations do not automatically mutate balances. The participant still checks independently and records confirmed payment manually. Reorganisations, replacement/conflicting transactions and unavailable servers require manual review.

## Audit verification (2026-11-19)

Run `npm test` for focused offline regressions and `npm run build` for the browser production bundle. See [criterion-by-criterion audit](../AUDIT-00-01-04.md) for exact results, limitations and participant gates. Passing these commands does not establish event eligibility or a completed chain/relay action.

## Local submission checks and release handoff

`npm run check:local` reports the three public submission fields. `npm run check:submission` fails until the published HTTPS talk/deck and repository URLs plus a valid mainnet token-enabled voting address are supplied. The browser banner uses the same validator and labels these checks separately from hosting, transaction and eligibility evidence. No owner or published link is invented.

`npm run package:preview` runs all 15 offline tests, builds the client and creates a clearly labelled review ZIP under `release/`, with `site/`, a handoff and SHA-256 manifest. `npm run package:release` also requires the strict public-config check; it currently stops on the three blank fields. Packaging performs no publication. Windows ZIP creation uses PowerShell; other systems receive the prepared folder.

`npm run smoke:release` temporarily serves the current production build on loopback port 14100, checks the index, bundled assets and static judge guide, then stops the server. The bundled `judge-guide.html` provides a two-minute fictional-expense walkthrough and the separate participant-authorized wallet segment. HTTP smoke checks do not establish visual or wallet interoperability.

See [local release handoff](LOCAL-RELEASE-HANDOFF.md) for the latest validated archive, exact outcomes and remaining participant actions. For hosting, upload only the generated `site/` contents at an HTTPS domain root. A live hosted check, wallet/transaction evidence and event/account actions remain pending.

## WizardConnect API compatibility

The installed dapp 0.2.8 derives public keys but does not allocate change indices. `change-policy.js` now reserves change within indices 0–19 using the actual `getSessionPaths()`/`getPubkey()` APIs, an exclusive browser Web Lock, a server history check and per-wallet persistent reservations. Cancellation and unknown outcomes retain reservations. If history/storage/locks are unavailable, or the bounded range is exhausted, payment preparation stops before signing.

Use a secure context and a dedicated small wallet. Locks coordinate this app's tabs on the same origin; another wallet, device or a server withholding history can escape those observations. Preserve local payment/reservation evidence before clearing browser data. See [change allocation compatibility fix](CHANGE-POLICY.md) for the precise policy and 15 passing offline regression tests. Existing mainnet consent, wallet authorization and transaction checks remain required.
