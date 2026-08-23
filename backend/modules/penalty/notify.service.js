/**
 * NOTIFICATION SERVICE — OWNER: S. Moontaha Rahman [SMR]
 *
 * One call sends the push AND writes the in-app record. Push can fail for a
 * dozen reasons outside our control — permission revoked, token rotated, no
 * Firebase project at all — so the Notification document is the durable copy
 * the bell icon reads. Delivery is best-effort; the record is not.
 */
const { User, Notification } = require('../../models');
const logger = require('../../utils/logger');
const { getPushProvider } = require('./providers');

/**
 * @param {object} p
 * @param {string} p.userId
 * @param {string} p.type   - NOTIFICATION_TYPE
 * @param {string} p.title
 * @param {string} p.body
 * @param {string} [p.deepLink]
 * @param {object} [p.meta]
 */
async function notify({ userId, type, title, body, deepLink = null, meta = null }) {
  // 1. Durable in-app record first — this must not depend on push succeeding.
  const record = await Notification.create({ userId, type, title, body, deepLink, meta });

  // 2. Best-effort push.
  try {
    const user = await User.findById(userId).select('fcmTokens notificationPrefs').lean();
    if (!user) return { record, pushed: false, reason: 'USER_NOT_FOUND' };

    if (user.notificationPrefs && user.notificationPrefs.push === false) {
      return { record, pushed: false, reason: 'OPTED_OUT' };
    }
    if (!user.fcmTokens?.length) {
      return { record, pushed: false, reason: 'NO_DEVICE_TOKENS' };
    }

    const provider = getPushProvider();
    const result = await provider.send({
      tokens: user.fcmTokens,
      title,
      body,
      data: { type, deepLink: deepLink || '/', notificationId: String(record._id) },
    });

    // Prune tokens FCM told us are dead, so the list does not grow stale.
    if (result.invalidTokens?.length) {
      await User.updateOne({ _id: userId }, { $pull: { fcmTokens: { $in: result.invalidTokens } } });
    }

    return { record, pushed: result.successCount > 0, provider: result.provider, result };
  } catch (err) {
    logger.warn(`[notify] push failed for ${userId}: ${err.message}`);
    return { record, pushed: false, reason: 'PUSH_ERROR' };
  }
}

module.exports = { notify };
