/**
 * WALLET TOP-UP SERVICE — OWNER: Tamal Deb Nath [TDN]
 * Multi-gateway, tokenized. The gateway is chosen by PAYMENT_PROVIDER; with no
 * sandbox configured it falls back to the mock so the whole flow still runs.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const { Wallet, LedgerEntry, User } = require('../../models');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { formatPoisha } = require('../../utils/money');
const { LEDGER_TYPE, ROLES } = require('../../shared/constants');
const { getGateway } = require('./gateways');
const { walletAccount } = require('./escrowHold.transaction');

const MAX_TOPUP = parseInt(process.env.WALLET_MAX_TOPUP_POISHA || '5000000', 10); // ৳50,000
const MIN_TOPUP = 10000; // ৳100

/** Ensures a wallet row exists — older accounts may predate wallet creation. */
async function ensureWallet(userId, role = ROLES.DRIVER) {
  const existing = await Wallet.findOne({ ownerId: userId });
  if (existing) return existing;
  return Wallet.create({ ownerId: userId, ownerRole: role, balancePoisha: 0 });
}

async function getWalletSummary(userId, role) {
  const wallet = await ensureWallet(userId, role);
  const entries = await LedgerEntry.find({ userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return {
    balancePoisha: wallet.balancePoisha,
    escrowPoisha: wallet.escrowPoisha,
    availablePoisha: wallet.balancePoisha,
    currency: wallet.currency,
    lastMovementAt: wallet.lastMovementAt,
    gateway: getGateway().name,
    recentEntries: entries,
  };
}

/** Step 1 — ask the gateway for a checkout session. No money moves yet. */
async function initiateTopUp({ userId, amountPoisha, method }) {
  const amount = Number(amountPoisha);
  if (!Number.isInteger(amount) || amount < MIN_TOPUP) {
    throw ApiError.badRequest(`The smallest top-up is ${formatPoisha(MIN_TOPUP)}`, undefined, {
      amountPoisha: `Enter at least ${formatPoisha(MIN_TOPUP)}`,
    });
  }
  if (amount > MAX_TOPUP) {
    throw ApiError.badRequest(`The largest single top-up is ${formatPoisha(MAX_TOPUP)}`, undefined, {
      amountPoisha: `Enter at most ${formatPoisha(MAX_TOPUP)}`,
    });
  }

  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.notFound('Account not found');

  await ensureWallet(userId, user.role);

  const gateway = getGateway();
  const reference = `PSC${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const session = await gateway.initiateTopUp({ amountPoisha: amount, user, reference });

  return { ...session, amountPoisha: amount, method: method || 'WALLET', minPoisha: MIN_TOPUP, maxPoisha: MAX_TOPUP };
}

/**
 * Step 2 — verify with the gateway, then credit the wallet inside a
 * transaction so the balance and the ledger entry can never disagree.
 */
async function confirmTopUp({ userId, token, payload = {} }) {
  if (!token) throw ApiError.badRequest('A transaction token is required');

  const gateway = getGateway(payload.provider);
  const verification = await gateway.verifyTopUp({ token, payload });

  if (!verification.success) {
    throw ApiError.badRequest(verification.reason || 'The payment was declined', undefined, {
      token,
      gateway: gateway.name,
    });
  }

  const amountPoisha = Number(verification.amountPoisha);
  if (!Number.isInteger(amountPoisha) || amountPoisha <= 0) {
    throw ApiError.badRequest('The gateway returned an invalid amount');
  }

  // Replay guard: the same token must never credit twice.
  const already = await LedgerEntry.findOne({ type: LEDGER_TYPE.TOPUP, note: `token:${token}` }).lean();
  if (already) {
    const wallet = await Wallet.findOne({ ownerId: userId }).lean();
    return { alreadyProcessed: true, amountPoisha, balancePoisha: wallet?.balancePoisha ?? 0 };
  }

  const dbSession = await mongoose.startSession();
  let result;
  try {
    await dbSession.withTransaction(async () => {
      const wallet = await Wallet.findOne({ ownerId: userId }).session(dbSession);
      if (!wallet) throw ApiError.badRequest('Your wallet has not been set up yet');

      await Wallet.updateOne(
        { _id: wallet._id },
        { $inc: { balancePoisha: amountPoisha }, $set: { lastMovementAt: new Date() } },
        { session: dbSession }
      );

      await LedgerEntry.create(
        [
          {
            type: LEDGER_TYPE.TOPUP,
            refType: 'TOPUP',
            refId: wallet._id,
            debitAccount: `gateway:${gateway.name}`,
            creditAccount: walletAccount(userId),
            amountPoisha,
            balanceAfterPoisha: wallet.balancePoisha + amountPoisha,
            userId,
            note: `token:${token}`,
          },
        ],
        { session: dbSession }
      );

      result = {
        amountPoisha,
        balancePoisha: wallet.balancePoisha + amountPoisha,
        gateway: gateway.name,
        token,
      };
    });
  } finally {
    await dbSession.endSession();
  }

  logger.info(`[escrow] wallet top-up ${formatPoisha(result.amountPoisha)} via ${result.gateway}`);
  return result;
}

/** Issues an opaque token for a payment instrument. Nothing sensitive stored. */
async function tokenizeInstrument({ userId, method }) {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.notFound('Account not found');
  const gateway = getGateway();
  const { token } = await gateway.tokenize({ user, method });
  return { token, gateway: gateway.name, method };
}

module.exports = { ensureWallet, getWalletSummary, initiateTopUp, confirmTopUp, tokenizeInstrument, MIN_TOPUP, MAX_TOPUP };
