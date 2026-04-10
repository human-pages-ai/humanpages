import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import crypto from 'crypto';
import { logger } from './logger.js';

// Lazy-initialized R2 client
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 storage not configured: missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY');
    }

    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return r2Client;
}

function getBucket(): string {
  return process.env.R2_BUCKET_NAME || 'humans-profile-photos';
}

/**
 * Check if R2 storage is properly configured without throwing.
 * Returns true if all required environment variables are set.
 */
export function isR2Configured(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
}

// Alias for backwards compatibility
export function isStorageConfigured(): boolean {
  return isR2Configured();
}

/**
 * Process raw image buffer → 256x256 WebP.
 * Accepts JPEG, PNG, WebP, AVIF, TIFF input.
 * Throws on invalid/corrupt image data.
 */
export async function processProfileImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate() // Auto-rotate based on EXIF orientation
    .resize(256, 256, { fit: 'cover', position: 'centre' })
    .withMetadata({ orientation: undefined }) // Strip all EXIF/GPS metadata
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Upload a processed image to R2.
 * Returns the R2 object key (e.g., "photos/{userId}/{uuid}.webp").
 */
export async function uploadProfilePhoto(userId: string, imageBuffer: Buffer): Promise<string> {
  const uuid = crypto.randomUUID();
  const key = `photos/${userId}/${uuid}.webp`;

  await getR2Client().send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: imageBuffer,
    ContentType: 'image/webp',
    CacheControl: 'private, max-age=3600',
  }));

  logger.info({ userId, key, size: imageBuffer.length }, 'Profile photo uploaded to R2');
  return key;
}

/**
 * Generate a pre-signed GET URL for reading a photo.
 * Returns null if the key is empty/undefined.
 * URL expires in 24 hours.
 */
export async function getProfilePhotoSignedUrl(key: string): Promise<string | null> {
  if (!key) return null;

  try {
    const url = await getSignedUrl(
      getR2Client(),
      new GetObjectCommand({ Bucket: getBucket(), Key: key }),
      { expiresIn: 86400 },
    );
    return url;
  } catch (err) {
    logger.error({ err, key }, 'Failed to generate signed URL');
    return null;
  }
}

/**
 * Fetch a photo from R2 as a Buffer (for moderation worker).
 * Returns null if the object doesn't exist.
 */
export async function getR2ObjectBuffer(key: string): Promise<Buffer | null> {
  try {
    const response = await getR2Client().send(new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }));
    if (!response.Body) return null;
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Delete a photo from R2. Idempotent — silently succeeds if key doesn't exist.
 */
export async function deleteProfilePhoto(key: string): Promise<void> {
  if (!key) return;

  try {
    await getR2Client().send(new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }));
    logger.info({ key }, 'Profile photo deleted from R2');
  } catch (err) {
    logger.error({ err, key }, 'Failed to delete photo from R2');
    // Don't throw — orphaned objects are acceptable
  }
}

// ===== Generic R2 helpers (video assets, etc.) =====

/**
 * Generate a presigned PUT URL for direct upload to R2.
 */
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const url = await getSignedUrl(
    getR2Client(),
    new PutObjectCommand({ Bucket: getBucket(), Key: key, ContentType: contentType }),
    { expiresIn },
  );
  return url;
}

/**
 * Generate a presigned GET URL for any R2 object.
 */
export async function getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string | null> {
  if (!key) return null;
  try {
    const url = await getSignedUrl(
      getR2Client(),
      new GetObjectCommand({ Bucket: getBucket(), Key: key }),
      { expiresIn },
    );
    return url;
  } catch (err) {
    logger.error({ err, key }, 'Failed to generate signed download URL');
    return null;
  }
}

/**
 * Check if an object exists in R2 and return its metadata.
 */
export async function headObject(key: string): Promise<{ contentLength: number; contentType: string } | null> {
  try {
    const res = await getR2Client().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return {
      contentLength: res.ContentLength ?? 0,
      contentType: res.ContentType ?? 'application/octet-stream',
    };
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Delete any R2 object by key. Idempotent.
 */
export async function deleteR2Object(key: string): Promise<void> {
  if (!key) return;
  try {
    await getR2Client().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
    logger.info({ key }, 'R2 object deleted');
  } catch (err) {
    logger.error({ err, key }, 'Failed to delete R2 object');
  }
}

/**
 * Upload a buffer directly to R2.
 * Returns the key for reference.
 */
export async function uploadToR2(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await getR2Client().send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=86400',
  }));
  logger.info({ key, size: buffer.length }, 'Object uploaded to R2');
}

/**
 * Download an image from an external URL (for OAuth photo import).
 * Validates content-type and enforces a 5MB size limit.
 */
export async function downloadExternalImage(url: string): Promise<Buffer> {
  // Validate URL scheme to prevent SSRF
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'image/*' },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to download image: HTTP ${response.status}`);
    }

    // Verify final URL after redirects is still HTTPS
    if (response.url && !response.url.startsWith('https://')) {
      throw new Error('Redirect to non-HTTPS URL blocked');
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length > 5 * 1024 * 1024) {
      throw new Error('Image too large (max 5MB)');
    }

    return buffer;
  } finally {
    clearTimeout(timeout);
  }
}
