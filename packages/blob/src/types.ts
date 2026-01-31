/**
 * Options for uploading a blob
 */
export interface PutBlobOptions {
  /** Path/key for the blob */
  pathname: string;
  /** Content to upload */
  body: Buffer;
  /** MIME type */
  contentType?: string;
  /** Cache-Control max-age in seconds */
  cacheControlMaxAge?: number;
}

/**
 * Result of a successful blob upload
 */
export interface PutBlobResult {
  /** Public URL of the uploaded blob */
  url: string;
  /** Path/key of the blob */
  pathname: string;
}

/**
 * Result of a blob deletion attempt
 */
export interface DeleteBlobResult {
  url: string;
  deleted: boolean;
  error?: string;
}

/**
 * Blob storage provider interface.
 * Implement this interface to support different storage backends.
 */
export interface BlobProvider {
  /**
   * Upload a blob to storage
   */
  put(options: PutBlobOptions): Promise<PutBlobResult>;

  /**
   * Delete blobs by URL
   */
  delete(urls: string[]): Promise<DeleteBlobResult[]>;
}
