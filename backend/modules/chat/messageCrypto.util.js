/**
 * ============================================================================
 * MESSAGE CRYPTO — OWNER: Maidul Islam [MI]
 * ============================================================================
 * AES-256-GCM encryption at rest for chat bodies.
 *
 * HONEST SCOPE: this is encryption AT REST, not end-to-end. The server holds
 * the key, so it could read messages — true E2E would need per-device keys and
 * is out of scope for a course project. What this does buy is real: a dump of
 * the MongoDB collection reveals nothing, which is the threat that actually
 * matters for a marketplace database.
 *
 * GCM over CBC because it authenticates as well as encrypts — a tampered
 * ciphertext fails to decrypt instead of silently producing garbage.
 *
 * Key handling: CHAT_ENCRYPTION_KEY from the environment, stretched with
 * scrypt so any length of passphrase works. With no key set, a deterministic
 * development key is derived and a warning is logged once — the app keeps
 * running rather than crashing a teammate who has not filled in their .env.
 * ============================================================================
 */
const crypto = require('crypto');
const logger = require('../../utils/logger');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;   // 96-bit nonce, the GCM standard
const SALT = 'parkshare-chat-v1';

let cachedKey = null;
let warned = false;

function getKey() {
  if (cachedKey) return cachedKey;

  const secret = process.env.CHAT_ENCRYPTION_KEY;
  if (!secret) {
    if (!warned) {
      logger.warn(
        '[chat] CHAT_ENCRYPTION_KEY is not set — using a development key. ' +
          'Set a real one before deploying.'
      );
      warned = true;
    }
    cachedKey = crypto.scryptSync('parkshare-dev-key-do-not-ship', SALT, 32);
    return cachedKey;
  }

  cachedKey = crypto.scryptSync(secret, SALT, 32);
  return cachedKey;
}

/** @returns {{cipherText: string, iv: string, tag: string}} all base64 */
function encrypt(plainText) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);

  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);

  return {
    cipherText: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

/** Returns a placeholder rather than throwing — one corrupt row must not break the thread. */
function decrypt({ cipherText, iv, tag }) {
  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(cipherText, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return '[message could not be decrypted]';
  }
}

/* ------------------------------------------------------------------------ */
/* Contact-detail redaction                                                 */
/* ------------------------------------------------------------------------ */

/**
 * The brief is "messaging without exposing phone numbers". Hiding the numbers
 * in the UI is not enough — people type them into the chat. These patterns
 * catch Bangladeshi mobiles (01XXXXXXXXX, +8801XXXXXXXXX), spaced or dashed
 * variants, and emails.
 */
const PATTERNS = [
  { name: 'phone', re: /(?:\+?88[\s-]?)?01[3-9][\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d[\s-]?\d/g },
  { name: 'phone', re: /\b\d{5}[\s-]?\d{6}\b/g },
  { name: 'email', re: /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g },
];

/**
 * @returns {{ text: string, redacted: boolean, kinds: string[] }}
 */
function redactContactDetails(input) {
  let text = String(input || '');
  const kinds = new Set();

  for (const { name, re } of PATTERNS) {
    text = text.replace(re, (match) => {
      // Ignore short numeric runs that are plainly not phone numbers.
      if (name === 'phone' && match.replace(/\D/g, '').length < 11) return match;
      kinds.add(name);
      return name === 'email' ? '[email hidden]' : '[number hidden]';
    });
  }

  return { text, redacted: kinds.size > 0, kinds: [...kinds] };
}

module.exports = { encrypt, decrypt, redactContactDetails, ALGORITHM };
