/**
 * DOCUMENT UPLOAD — OWNER: S. Moontaha Rahman [SMR]
 *
 * Accepts a base64 payload and stores it, either on local disk (development)
 * or Cloudinary (production). Base64 over JSON rather than multipart keeps the
 * dependency list unchanged — multer would be another package for one route.
 *
 * ⚠️ Render's filesystem is EPHEMERAL. Anything written to local disk is gone
 * on the next deploy or sleep. Set CLOUDINARY_* before the demo or NID scans
 * will vanish. The warning below fires loudly in production.
 */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_MB = Number(process.env.MAX_UPLOAD_MB) || 5;
const ALLOWED = (process.env.ALLOWED_DOC_MIME_TYPES || 'image/jpeg,image/png,application/pdf')
  .split(',')
  .map((s) => s.trim());

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
  'image/webp': '.webp',
};

const cloudinaryConfigured = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

/** Splits a data URL or accepts { mimeType, base64 }. */
function parsePayload(input) {
  if (!input) throw ApiError.badRequest('No file was attached');

  let mimeType = input.mimeType;
  let base64 = input.base64 || input.data;

  if (typeof input === 'string' || (!base64 && input.dataUrl)) {
    const dataUrl = typeof input === 'string' ? input : input.dataUrl;
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
    if (!match) throw ApiError.badRequest('That file could not be read');
    [, mimeType, base64] = match;
  }

  if (!mimeType || !base64) {
    throw ApiError.badRequest('Attach a file', undefined, { file: 'A file and its type are required' });
  }
  if (!ALLOWED.includes(mimeType)) {
    throw ApiError.badRequest(`Upload a ${ALLOWED.map((m) => m.split('/')[1]).join(', ')} file`, undefined, {
      file: `${mimeType} is not accepted`,
    });
  }

  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) throw ApiError.badRequest('That file appears to be empty');
  if (buffer.length > MAX_MB * 1024 * 1024) {
    throw ApiError.badRequest(`Keep files under ${MAX_MB} MB`, undefined, {
      file: `That file is ${(buffer.length / 1024 / 1024).toFixed(1)} MB`,
    });
  }

  return { mimeType, buffer };
}

/** Unsigned-signature Cloudinary upload — no SDK required. */
async function uploadToCloudinary({ buffer, mimeType, folder }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash('sha1')
    .update(paramsToSign + process.env.CLOUDINARY_API_SECRET)
    .digest('hex');

  const form = new FormData();
  form.append('file', `data:${mimeType};base64,${buffer.toString('base64')}`);
  form.append('api_key', process.env.CLOUDINARY_API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    { method: 'POST', body: form }
  );
  const json = await response.json();

  if (!response.ok || !json.secure_url) {
    throw new ApiError(502, json.error?.message || 'The document could not be uploaded');
  }
  return { url: json.secure_url, storage: 'cloudinary' };
}

async function uploadToDisk({ buffer, mimeType, hostId, kind }) {
  const dir = path.join(UPLOAD_DIR, 'verification', String(hostId));
  await fs.mkdir(dir, { recursive: true });

  const filename = `${kind.toLowerCase()}-${crypto.randomBytes(6).toString('hex')}${EXTENSIONS[mimeType] || ''}`;
  await fs.writeFile(path.join(dir, filename), buffer);

  if (process.env.NODE_ENV === 'production') {
    logger.warn(
      '[verification] a document was written to local disk in production. Render wipes this on deploy — set CLOUDINARY_*.'
    );
  }

  // app.js serves UPLOAD_DIR at /uploads.
  return { url: `/uploads/verification/${hostId}/${filename}`, storage: 'local' };
}

/**
 * @returns {{kind, url, mimeType, sizeBytes, storage, uploadedAt}}
 */
async function storeDocument({ hostId, kind, file }) {
  const { mimeType, buffer } = parsePayload(file);

  const stored = cloudinaryConfigured()
    ? await uploadToCloudinary({ buffer, mimeType, folder: `parkshare/verification/${hostId}` })
    : await uploadToDisk({ buffer, mimeType, hostId, kind });

  return {
    kind,
    url: stored.url,
    mimeType,
    sizeBytes: buffer.length,
    storage: stored.storage,
    uploadedAt: new Date(),
  };
}

module.exports = { storeDocument, parsePayload, cloudinaryConfigured, ALLOWED, MAX_MB };
