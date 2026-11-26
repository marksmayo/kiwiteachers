/** In-memory stand-in for @vercel/blob. */
export const blobStore = new Map<string, Uint8Array>();

export const blobModule = {
  get: async (pathname: string) => {
    const bytes = blobStore.get(pathname);
    if (!bytes) return null;
    return { statusCode: 200, stream: new Blob([bytes as BlobPart]).stream(), headers: new Headers(), blob: {} };
  },
  del: async (paths: string | string[]) => {
    for (const p of Array.isArray(paths) ? paths : [paths]) blobStore.delete(p);
  },
  put: async (pathname: string, body: Uint8Array, opts: { addRandomSuffix?: boolean } = {}) => {
    const final = opts.addRandomSuffix ? pathname.replace(/(\.[a-z]+)?$/, (ext) => `-${Math.random().toString(36).slice(2, 8)}${ext}`) : pathname;
    blobStore.set(final, new Uint8Array(body));
    return { pathname: final, url: `https://blob.test/${final}` };
  },
};
