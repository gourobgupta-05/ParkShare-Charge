/**
 * ACCOUNT LOCK — OWNER: S. Moontaha Rahman [SMR]
 *
 * A locked driver cannot create new bookings. The lock is applied by
 * middleware/auth.blockIfPenaltyLocked, which the calendar route already
 * uses — deliberately NOT applied to payment routes, because a driver locked
 * out of paying could never clear the penalty that locked them.
 */
const { User } = require('../../models');
const logger = require('../../utils/logger');
const { ACCOUNT_STATE, NOTIFICATION_TYPE } = require('../../shared/constants');
const { notify } = require('./notify.service');

async function lockAccount({ driverId, penalty, reason = 'Unpaid overstay penalty' }) {
  const user = await User.findById(driverId).select('accountState name').lean();
  if (!user) return { locked: false, reason: 'USER_NOT_FOUND' };
  if (user.accountState === ACCOUNT_STATE.LOCKED_PENALTY) return { locked: true, alreadyLocked: true };
  if (user.accountState === ACCOUNT_STATE.SUSPENDED) return { locked: false, reason: 'SUSPENDED' };

  await User.updateOne({ _id: driverId }, { $set: { accountState: ACCOUNT_STATE.LOCKED_PENALTY } });

  logger.warn(`[penalty] account ${driverId} locked — ${reason}`);

  notify({
    userId: driverId,
    type: NOTIFICATION_TYPE.PENALTY,
    title: 'Account locked',
    body: 'You have an unpaid overstay penalty. Settle it to book again.',
    deepLink: penalty ? `/bookings/${penalty.bookingId}` : '/profile',
    meta: penalty ? { penaltyId: String(penalty._id) } : null,
  }).catch(() => {});

  return { locked: true, alreadyLocked: false };
}

/**
 * Unlocks only when nothing is outstanding. Checking here rather than at the
 * call site means a driver who settles one of two penalties stays locked,
 * which is the correct behaviour.
 */
async function unlockIfClear({ driverId }) {
  // Required lazily: penalty.model and this file would otherwise form a cycle.
  const Penalty = require('./penalty.model');
  const { PENALTY_STATUS } = require('../../shared/constants');

  const outstanding = await Penalty.countDocuments({
    driverId,
    status: PENALTY_STATUS.ACCRUING,
  });
  if (outstanding > 0) return { unlocked: false, outstanding };

  const user = await User.findById(driverId).select('accountState').lean();
  if (user?.accountState !== ACCOUNT_STATE.LOCKED_PENALTY) {
    return { unlocked: false, reason: 'NOT_LOCKED' };
  }

  await User.updateOne(
    { _id: driverId, accountState: ACCOUNT_STATE.LOCKED_PENALTY },
    { $set: { accountState: ACCOUNT_STATE.ACTIVE } }
  );

  logger.info(`[penalty] account ${driverId} unlocked`);

  notify({
    userId: driverId,
    type: NOTIFICATION_TYPE.PENALTY,
    title: 'Account unlocked',
    body: 'Your penalty is settled. You can book again.',
    deepLink: '/search',
  }).catch(() => {});

  return { unlocked: true, outstanding: 0 };
}

module.exports = { lockAccount, unlockIfClear };
