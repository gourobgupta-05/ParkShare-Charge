/**
 * PAYOUT SERVICE — OWNER: S. Moontaha Rahman [SMR]
 * Earnings reads and host withdrawals. The settlement itself lives in
 * settlement.transaction.js.
 */
const mongoose = require('mongoose');
const { Wallet, LedgerEntry, User, Booking } = require('../../models');
const PayoutBatch = require('./payoutBatch.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { formatPoisha } = require('../../utils/money');
const { LEDGER_TYPE, ROLES, ACCOUNT_STATE } = require('../../shared/constants');
const { walletAccount } = require('./settlement.transaction');

const MIN_WITHDRAWAL = Number(process.env.PAYOUT_MIN_BALANCE_POISHA) || 50000; // ৳500

/** Headline numbers for the host earnings dashboard. */
async function getEarnings({ hostId }) {
  const [wallet, totals, recent, pendingBookings] = await Promise.all([
    Wallet.findOne({ ownerId: hostId }).lean(),
    PayoutBatch.aggregate([
      { $match: { hostId: new mongoose.Types.ObjectId(String(hostId)), kind: 'SETTLEMENT' } },
      {
        $group: {
          _id: null,
          sessions: { $sum: 1 },
          grossPoisha: { $sum: '$grossPoisha' },
          commissionPoisha: { $sum: '$commissionPoisha' },
          hostCreditPoisha: { $sum: '$hostCreditPoisha' },
        },
      },
    ]),
    PayoutBatch.find({ hostId }).sort({ createdAt: -1 }).limit(20).lean(),
    // Money still in escrow: sessions finished but not yet settled.
    Booking.aggregate([
      {
        $match: {
          hostId: new mongoose.Types.ObjectId(String(hostId)),
          'escrow.status': 'HELD',
        },
      },
      { $group: { _id: null, pendingPoisha: { $sum: '$escrow.heldPoisha' }, count: { $sum: 1 } } },
    ]),
  ]);

  const summary = totals[0] || {
    sessions: 0, grossPoisha: 0, commissionPoisha: 0, hostCreditPoisha: 0,
  };

  return {
    balancePoisha: wallet?.balancePoisha || 0,
    availableToWithdrawPoisha: wallet?.balancePoisha || 0,
    minWithdrawalPoisha: MIN_WITHDRAWAL,
    pending: pendingBookings[0] || { pendingPoisha: 0, count: 0 },
    lifetime: summary,
    effectiveCommissionRate: summary.grossPoisha
      ? Number((summary.commissionPoisha / summary.grossPoisha).toFixed(4))
      : null,
    recentBatches: recent,
  };
}

/** The host's own ledger lines, newest first. */
async function getLedger({ userId, page = 1, limit = 25 }) {
  const account = walletAccount(userId);

  const match = {
    $or: [{ userId: new mongoose.Types.ObjectId(String(userId)) }, { creditAccount: account }, { debitAccount: account }],
  };

  const [items, total] = await Promise.all([
    LedgerEntry.find(match).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    LedgerEntry.countDocuments(match),
  ]);

  return {
    items: items.map((e) => ({
      ...e,
      direction: e.creditAccount === account ? 'IN' : e.debitAccount === account ? 'OUT' : 'INFO',
    })),
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Moves the host's balance out to their payout channel.
 *
 * In this project that is an internal ledger movement, not a real
 * disbursement — no student team can hold a payout licence, and pretending
 * otherwise would be dishonest in the report. The record and the accounting
 * are real; the bank transfer is marked REQUESTED for an operator to action.
 */
async function requestWithdrawal({ hostId, amountPoisha }) {
  const host = await User.findById(hostId);
  if (!host) throw ApiError.notFound('Account not found');
  if (host.role !== ROLES.HOST) throw ApiError.forbidden('Only hosts can withdraw earnings');
  if (host.accountState !== ACCOUNT_STATE.ACTIVE) {
    throw ApiError.forbidden('Your account is not active, so withdrawals are paused');
  }
  if (!host.payoutChannel?.type) {
    throw ApiError.badRequest('Add a payout method before withdrawing', undefined, {
      payoutChannel: 'Set bKash or a bank account in your profile first',
    });
  }

  const wallet = await Wallet.findOne({ ownerId: hostId });
  if (!wallet) throw ApiError.badRequest('Your wallet has not been set up yet');

  const amount = Number(amountPoisha);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw ApiError.badRequest('Enter a valid amount', undefined, {
      amountPoisha: 'Amount must be a whole number of poisha',
    });
  }
  if (amount < MIN_WITHDRAWAL) {
    throw ApiError.badRequest(`The smallest withdrawal is ${formatPoisha(MIN_WITHDRAWAL)}`, undefined, {
      amountPoisha: `Withdraw at least ${formatPoisha(MIN_WITHDRAWAL)}`,
    });
  }
  if (wallet.balancePoisha < amount) {
    throw ApiError.badRequest(
      `You have ${formatPoisha(wallet.balancePoisha)} available`,
      undefined,
      { amountPoisha: 'That is more than your balance' }
    );
  }

  const session = await mongoose.startSession();
  let batch;

  try {
    await session.withTransaction(async () => {
      // Guarded decrement — two tabs cannot both drain the same balance.
      const debited = await Wallet.updateOne(
        { _id: wallet._id, balancePoisha: { $gte: amount } },
        { $inc: { balancePoisha: -amount }, $set: { lastMovementAt: new Date() } },
        { session }
      );
      if (debited.modifiedCount !== 1) {
        throw ApiError.conflict('Your balance changed mid-request. Try again.');
      }

      await User.updateOne({ _id: hostId }, { $inc: { balancePoisha: -amount } }, { session });

      await LedgerEntry.create(
        [
          {
            type: LEDGER_TYPE.PAYOUT,
            refType: 'PAYOUT',
            refId: wallet._id,
            debitAccount: walletAccount(hostId),
            creditAccount: `payout:${host.payoutChannel.type.toLowerCase()}`,
            amountPoisha: amount,
            balanceAfterPoisha: wallet.balancePoisha - amount,
            userId: hostId,
            note: 'Withdrawal requested',
          },
        ],
        { session }
      );

      [batch] = await PayoutBatch.create(
        [
          {
            kind: 'WITHDRAWAL',
            hostId,
            grossPoisha: amount,
            commissionRate: 0,
            commissionPoisha: 0,
            hostCreditPoisha: amount,
            status: 'REQUESTED',
            payoutChannel: {
              type: host.payoutChannel.type,
              accountRef: host.payoutChannel.accountRef,
            },
            note: 'Awaiting operator disbursement',
          },
        ],
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  logger.info(`[payout] host ${hostId} requested ${formatPoisha(amount)}`);
  return { batch, balancePoisha: wallet.balancePoisha - amount };
}

/* --------------------------------------------------------------- admin -- */

async function listAllBatches({ kind, status, page = 1, limit = 20 }) {
  const match = {};
  if (kind) match.kind = kind;
  if (status) match.status = status;

  const [items, total, totals] = await Promise.all([
    PayoutBatch.find(match)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('hostId', 'name businessName email')
      .lean(),
    PayoutBatch.countDocuments(match),
    PayoutBatch.aggregate([
      { $match: { kind: 'SETTLEMENT' } },
      {
        $group: {
          _id: null,
          grossPoisha: { $sum: '$grossPoisha' },
          commissionPoisha: { $sum: '$commissionPoisha' },
          hostCreditPoisha: { $sum: '$hostCreditPoisha' },
          settlements: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit) || 1,
    platformTotals: totals[0] || { grossPoisha: 0, commissionPoisha: 0, hostCreditPoisha: 0, settlements: 0 },
  };
}

/** Marks a withdrawal as disbursed. */
async function markWithdrawalPaid({ batchId, adminId }) {
  if (!mongoose.isValidObjectId(batchId)) throw ApiError.badRequest('That is not a valid payout id');

  const batch = await PayoutBatch.findById(batchId);
  if (!batch) throw ApiError.notFound('That payout no longer exists');
  if (batch.kind !== 'WITHDRAWAL') throw ApiError.badRequest('Only withdrawals can be marked paid');
  if (batch.status === 'PAID') return { batch, alreadyPaid: true };

  batch.status = 'PAID';
  batch.settledAt = new Date();
  batch.note = `Disbursed by admin ${adminId}`;
  await batch.save();

  return { batch, alreadyPaid: false };
}

module.exports = { getEarnings, getLedger, requestWithdrawal, listAllBatches, markWithdrawalPaid, MIN_WITHDRAWAL };
