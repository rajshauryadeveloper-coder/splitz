import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';

const pathname = 'splitz/ledger.json';
const directory = new URL('../.data/', import.meta.url);
const file = new URL('ledger.json', directory);
const empty = () => ({ revision: null, expenses: [], payments: [] });

export const conflict = () => Object.assign(new Error('Someone changed the ledger. Review the latest amounts and try again.'), { status: 409 });

export async function load() {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL) {
    const { get } = await import('@vercel/blob');
    const result = await get(pathname, { access: 'private', useCache: false });
    if (!result) return { data: empty(), etag: null };
    return { data: await new Response(result.stream).json(), etag: result.blob.etag };
  }
  try {
    return { data: JSON.parse(await readFile(file, 'utf8')) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { data: empty() };
  }
}

export async function save(data, etag) {
  const json = JSON.stringify(data, null, 2) + '\n';
  if (etag !== undefined) {
    const { put, BlobPreconditionFailedError } = await import('@vercel/blob');
    try {
      await put(pathname, json, {
        access: 'private', contentType: 'application/json', addRandomSuffix: false,
        allowOverwrite: Boolean(etag), ...(etag ? { ifMatch: etag } : {}),
      });
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError || (!etag && (await load()).etag)) throw conflict();
      throw error;
    }
    return;
  }

  await mkdir(directory, { recursive: true });
  const temporary = new URL(data.revision + '.tmp', directory);
  await writeFile(temporary, json);
  await rename(temporary, file);
}
