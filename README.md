# Splitz

A static trip expense ledger for nine friends. Pick a name, enter what each payer paid, then split the bill equally or enter custom shares. The dashboard shows outstanding payments and completed transfers. Record a full or partial payment from the settlement list. Expand a bill’s split to see what each person paid and their share. Amounts are in INR.

## Run locally

With Node.js 24, run `npm run dev` and open http://127.0.0.1:3000. Run `npm test` to check the split calculations.

## Deploy to Vercel

Import this repository, select **Other** as the framework preset, and deploy. The app is served from `public/` and needs no storage service or environment variables. Remove any custom build command left over from a previous setup.

The starting ledger is defined in `public/ledger.js`. Any bills added to that file are public. Changes made in the app are saved in browser storage for that site. Devices and browser profiles have separate ledgers. Data from the former server ledger is not imported automatically.

Recorded transfers stay in the ledger when expenses are edited or deleted. If a change leaves someone overpaid, the dashboard shows the amount to return. Use **Undo** in completed payments to correct a transfer that was recorded by mistake.
