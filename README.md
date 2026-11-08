# Splitz

A shared trip expense ledger for nine friends. Pick a name, enter what each payer paid, then split the bill equally or enter custom shares. The dashboard shows outstanding payments and completed transfers. Record a full or partial payment from the settlement list. Expand a bill’s split to see what each person paid and their share. Amounts are in INR.

## Run locally

With Node.js 24, run `npm run dev` and open http://127.0.0.1:3000. The app creates `.data/ledger.json` on the first save. Run `npm test` to check the split calculations.

## Deploy to Vercel

1. Import this project into Vercel and keep the framework preset set to Other.
2. In the project’s **Storage** tab, create or connect a **private Vercel Blob** store. Connect it to **Production**. Vercel provides `BLOB_STORE_ID` for OIDC authentication or `BLOB_READ_WRITE_TOKEN` for a legacy connection.
3. Deploy or redeploy, then share the URL. Vercel stores the shared JSON file at `splitz/ledger.json` in the connected store. Use a separate store for any preview deployment that needs its own ledger.

Anyone with the URL can read and change the shared ledger. Name selection changes the view.

Recorded transfers stay in the ledger when expenses are edited or deleted. If a change leaves someone overpaid, the dashboard shows the amount to return. Use **Undo** in completed payments to correct a transfer that was recorded by mistake.
