/**
 * Ports for uploads and account deletion. `R2Like` is the subset of the Workers
 * `R2Bucket` we use, so tests pass a fake bucket and never touch Cloudflare.
 */

export interface R2ObjectBodyLike {
  key: string;
  size: number;
  httpEtag?: string;
  body: ReadableStream;
}

export interface R2ListResult {
  objects: { key: string }[];
  truncated: boolean;
  cursor?: string;
}

export interface R2Like {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array<ArrayBuffer>,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectBodyLike | null>;
  /** Up to 1000 keys per call. */
  delete(keys: string | string[]): Promise<void>;
  /** Up to 1000 objects per page; follow `cursor` while `truncated`. */
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<R2ListResult>;
}

export type UploadRecord = {
  id: string;
  userId: string;
  r2Key: string;
  mime: string;
  bytes: number;
};

export interface UploadRepo {
  /** Sum of `uploads.bytes` for the user (0 when none). */
  totalBytes(userId: string): Promise<number>;
  insert(row: UploadRecord): Promise<void>;
  /** The upload with this id, any owner. Null for unknown or non-uuid ids. */
  get(id: string): Promise<UploadRecord | null>;
  /** Deletes the row when it belongs to `userId`. Returns whether a row was removed. */
  deleteOwned(userId: string, id: string): Promise<boolean>;
  /** Owner and raw state of the canvas with this share token, or null. */
  findSharedCanvas(token: string): Promise<{ userId: string; state: unknown } | null>;
}
