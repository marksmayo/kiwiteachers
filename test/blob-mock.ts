/** In-memory stand-in for @vercel/blob. */
export const blobStore = new Map<string, Uint8Array>();
/** Upload times for `list`; blobs without an entry count as just uploaded. */
export const blobUploadedAt = new Map<string, Date>();

export const blobModule = {
  get: async (pathname: string) => {
    const bytes = blobStore.get(pathname);
    if (!bytes) return null;
    return { statusCode: 200, stream: new Blob([bytes as BlobPart]).stream(), headers: new Headers(), blob: {} };
  },
  del: async (paths: string | string[]) => {
    for (const p of Array.isArray(paths) ? paths : [paths]) blobStore.delete(p);
  },
  list: async ({ prefix = "", cursor, limit = 1000 }: { prefix?: string; cursor?: string; limit?: number } = {}) => {
    const all = [...blobStore.keys()].filter((p) => p.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const hasMore = start + limit < all.length;
    return {
      blobs: all.slice(start, start + limit).map((pathname) => ({
        pathname,
        url: `https://blob.test/${pathname}`,
        size: blobStore.get(pathname)!.byteLength,
        uploadedAt: blobUploadedAt.get(pathname) ?? new Date(),
      })),
      cursor: hasMore ? String(start + limit) : undefined,
      hasMore,
    };
  },
  put: async (pathname: string, body: Uint8Array, opts: { addRandomSuffix?: boolean } = {}) => {
    const final = opts.addRandomSuffix ? pathname.replace(/(\.[a-z]+)?$/, (ext) => `-${Math.random().toString(36).slice(2, 8)}${ext}`) : pathname;
    blobStore.set(final, new Uint8Array(body));
    return { pathname: final, url: `https://blob.test/${final}` };
  },
};
