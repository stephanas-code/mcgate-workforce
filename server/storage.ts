import { put, del } from '@vercel/blob';

/**
 * Upload a document buffer or base64 string to Vercel Blob Storage
 * with automatic fallback to in-memory/base64 data URI for local development.
 *
 * @param filename File name (e.g. 'architecture_spec.pdf')
 * @param data Binary Buffer or string
 * @param mimeType MIME content type
 * @returns Public or base64 CDN URL and size
 */
export async function uploadToStorage(
  filename: string,
  data: Buffer | string,
  mimeType: string
): Promise<{ url: string; size: number }> {
  // Check if Vercel Blob token is configured
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  const buffer = Buffer.isBuffer(data)
    ? data
    : data.startsWith('data:')
    ? Buffer.from(data.split(',')[1] || '', 'base64')
    : Buffer.from(data, 'base64');

  if (!token) {
    // Local / Offline fallback: return standard data URI
    return {
      url: `data:${mimeType};base64,${buffer.toString('base64')}`,
      size: buffer.length
    };
  }

  try {
    const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const pathname = `mcgate-docs/${Date.now()}-${cleanName}`;

    const blob = await put(pathname, buffer, {
      access: 'public',
      contentType: mimeType,
      token
    });

    return {
      url: blob.url,
      size: buffer.length
    };
  } catch (err) {
    console.warn('[Storage] Vercel Blob upload failed, falling back to data URI:', err);
    return {
      url: `data:${mimeType};base64,${buffer.toString('base64')}`,
      size: buffer.length
    };
  }
}

/**
 * Delete a document from Vercel Blob Storage
 */
export async function deleteFromStorage(blobUrl: string): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || !blobUrl || !blobUrl.startsWith('http')) {
    return;
  }

  try {
    await del(blobUrl, { token });
  } catch (err) {
    console.warn('[Storage] Failed to delete blob from Vercel storage:', err);
  }
}
