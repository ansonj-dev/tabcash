# Deploying TabCash (static)

TabCash is a client-side static site. `npm run build` writes a self-contained `dist/` (HTML, hashed JS/CSS, `judge-guide.html`, icon). No server, functions or environment variables are needed. State lives in the visitor's `localStorage`. The only external service is the WizardConnect relay, contacted only after a user clicks **Connect wallet**.

Status: nothing has been deployed by this repository's tooling. No hosted URL exists until you run one of the commands below.

## Build

```powershell
npm install   # only if node_modules is missing
npm run build
```

Output: `dist/`. Asset URLs are root-absolute (`/assets/...`), so serve from the domain root, not a sub-path (see GitHub Pages).

## One-command deploys

| Host | Command |
|---|---|
| Cloudflare Pages | `npx wrangler pages deploy dist` |
| Vercel (static) | `npx vercel deploy dist --prod` |

Both prompt for sign-in and project name on first run.

- **Netlify:** drag the `dist/` folder onto https://app.netlify.com/drop.
- **GitHub Pages:** publish the `dist/` contents at a domain root (user/org site or custom domain). A project sub-path such as `/repo/` breaks the `/assets/...` URLs unless you set Vite `base`.

## Verify the deployed page

1. Open the printed URL. The hero "Split the tab." and the **Sample demo / My tab** switch should appear.
2. Open `<url>/judge-guide.html`.
3. In the browser dev tools Network tab, confirm `/assets/index-*.js` (about 28 kB) loads, and that `wallet-*.js` loads only after clicking **Connect wallet**.
4. Optional local check of the built output: `npm run smoke:release`.

## Reminders

- **Sample demo** uses fictional data and never sends BCH.
- **My tab** uses real BCH mainnet, only after you connect a wallet, tick the mainnet acknowledgment and approve the transaction in your wallet.
- Wallet connection needs outbound access to the WizardConnect relay and Electrum servers. If you add CSP headers, allow them.
- `submission.js` fields `widgetFactorySlideUrl` and `ember2026DonationAddress` are human-provided. `npm run check:local` reports them as pending until filled.
