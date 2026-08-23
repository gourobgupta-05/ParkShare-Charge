/**
 * CHAT SERVICE — OWNER: Maidul Islam [MI]
 *
 * Driver ↔ host coordination without exposing phone numbers. Two things make
 * that true rather than merely claimed:
 *   1. No contact field is ever returned by these endpoints — participants are
 *      projected down to name and avatar only.
 *   2. Message bodies are scrubbed of phone numbers and emails BEFORE
 *      encryption, so a number typed into the chat never reaches the database.
 */
const mongoose = require('mongoose');
const { Booking, Property, User } = require('../../models');
const ChatThread = require('./chatThread.model');
const Message = require('./message.model');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');
const { ROLES, BOOKING_STATUS } = require('../../shared/constants');
const crypto = require('./messageCrypto.util');

const MAX_LENGTH = Number(process.env.CHAT_MESSAGE_MAX_LENGTH) || 1000;
const PAGE_SIZE = Number(process.env.CHAT_HISTORY_PAGE_SIZE) || 50;

/** Threads close once the booking is finished, so old chats cannot be revived. */
const CHATTABLE = [
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.EN_ROUTE,
  BOOKING_STATUS.ACTIVE,
  BOOKING_STATUS.OVERSTAY,
  BOOKING_STATUS.DISPUTED,
];

/** Safe participant projection — name and avatar only. Never phone or email. */
const PARTICIPANT_FIELDS = 'name avatarUrl businessName role';

function roleKey(thread, userId) {
  return String(thread.driverId) === String(userId) ? 'driver' : 'host';
}

/**
 * Finds or creates the thread for a booking.
 * Chat opens only after payment: an unpaid booking must not give a driver a
 * private line to a host's inbox.
 */
async function ensureThread({ bookingId, userId, role }) {
  if (!mongoose.isValidObjectId(bookingId)) throw ApiError.badRequest('That is not a valid booking id');

  const booking = await Booking.findById(bookingId).lean();
  if (!booking) throw ApiError.notFound('That booking no longer exists');

  const isParty =
    String(booking.driverId) === String(userId) || String(booking.hostId) === String(userId);
  if (!isParty && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You are not a party to this booking');
  }

  if (!CHATTABLE.includes(booking.status)) {
    throw ApiError.badRequest(
      booking.status === BOOKING_STATUS.PENDING_PAYMENT
        ? 'Chat opens once the booking is paid for'
        : 'This booking is closed, so its chat is no longer available'
    );
  }

  let thread = await ChatThread.findOne({ bookingId });
  if (!thread) {
    try {
      thread = await ChatThread.create({
        bookingId,
        propertyId: booking.propertyId,
        driverId: booking.driverId,
        hostId: booking.hostId,
      });
    } catch (err) {
      if (err.code === 11000) thread = await ChatThread.findOne({ bookingId });
      else throw err;
    }
  }

  return thread;
}

/** Loads a thread and confirms the caller belongs to it. */
async function loadThread(threadId, userId, role) {
  if (!mongoose.isValidObjectId(threadId)) throw ApiError.badRequest('That is not a valid thread id');

  const thread = await ChatThread.findById(threadId);
  if (!thread) throw ApiError.notFound('That conversation no longer exists');

  const isParty =
    String(thread.driverId) === String(userId) || String(thread.hostId) === String(userId);
  if (!isParty && role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You are not part of this conversation');
  }
  return thread;
}

/** Every conversation the user is in, newest activity first. */
async function listThreads({ userId, role }) {
  const match = role === ROLES.HOST ? { hostId: userId } : { driverId: userId };

  const threads = await ChatThread.find(match)
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .limit(50)
    .populate('driverId', PARTICIPANT_FIELDS)
    .populate('hostId', PARTICIPANT_FIELDS)
    .populate('propertyId', 'title address propertyType')
    .lean();

  return {
    items: threads.map((t) => {
      const key = String(t.driverId?._id || t.driverId) === String(userId) ? 'driver' : 'host';
      const other = key === 'driver' ? t.hostId : t.driverId;
      return {
        _id: t._id,
        bookingId: t.bookingId,
        property: t.propertyId,
        counterparty: {
          _id: other?._id,
          name: other?.businessName || other?.name || 'User',
          avatarUrl: other?.avatarUrl || null,
        },
        lastMessageAt: t.lastMessageAt,
        messageCount: t.messageCount,
        unreadCount: t.unread?.[key] || 0,
        isClosed: t.isClosed,
      };
    }),
    total: threads.length,
  };
}

/** Decrypted history, oldest first so it renders top-to-bottom. */
async function getMessages({ threadId, userId, role, before, limit }) {
  const thread = await loadThread(threadId, userId, role);

  const capped = Math.min(Math.max(parseInt(limit, 10) || PAGE_SIZE, 1), 100);
  const query = { threadId: thread._id };
  if (before && !Number.isNaN(Date.parse(before))) query.createdAt = { $lt: new Date(before) };

  const rows = await Message.find(query).sort({ createdAt: -1 }).limit(capped).lean();

  const items = rows.reverse().map((m) => ({
    _id: m._id,
    threadId: m.threadId,
    senderId: m.senderId,
    senderRole: m.senderRole,
    isMine: String(m.senderId) === String(userId),
    body: crypto.decrypt(m),
    wasRedacted: m.wasRedacted,
    redactedKinds: m.redactedKinds,
    readAt: m.readAt,
    createdAt: m.createdAt,
  }));

  return { threadId: thread._id, items, hasMore: rows.length === capped, pageSize: capped };
}

/**
 * Stores one message. Returns the decrypted view so the caller can broadcast
 * it without a second database round-trip.
 */
async function sendMessage({ threadId, userId, role, body }) {
  const thread = await loadThread(threadId, userId, role);
  if (thread.isClosed) throw ApiError.badRequest('This conversation is closed');

  const raw = String(body || '').trim();
  if (!raw) throw ApiError.badRequest('Write a message first', undefined, { body: 'Message cannot be empty' });
  if (raw.length > MAX_LENGTH) {
    throw ApiError.badRequest(`Keep messages under ${MAX_LENGTH} characters`, undefined, {
      body: `That is ${raw.length} characters`,
    });
  }

  // Scrub contact details BEFORE encrypting — the number never hits the disk.
  const { text, redacted, kinds } = crypto.redactContactDetails(raw);
  const sealed = crypto.encrypt(text);

  const message = await Message.create({
    threadId: thread._id,
    bookingId: thread.bookingId,
    senderId: userId,
    senderRole: role,
    ...sealed,
    wasRedacted: redacted,
    redactedKinds: kinds,
  });

  const senderKey = roleKey(thread, userId);
  const recipientKey = senderKey === 'driver' ? 'host' : 'driver';

  await ChatThread.updateOne(
    { _id: thread._id },
    {
      $set: { lastMessageAt: message.createdAt, lastMessageBy: userId },
      $inc: { messageCount: 1, [`unread.${recipientKey}`]: 1 },
    }
  );

  return {
    message: {
      _id: message._id,
      threadId: thread._id,
      senderId: userId,
      senderRole: role,
      body: text,
      wasRedacted: redacted,
      redactedKinds: kinds,
      createdAt: message.createdAt,
      readAt: null,
    },
    thread,
    recipientId: recipientKey === 'driver' ? thread.driverId : thread.hostId,
  };
}

async function markRead({ threadId, userId, role }) {
  const thread = await loadThread(threadId, userId, role);
  const key = roleKey(thread, userId);

  await Promise.all([
    Message.updateMany(
      { threadId: thread._id, senderId: { $ne: userId }, readAt: null },
      { $set: { readAt: new Date() } }
    ),
    ChatThread.updateOne({ _id: thread._id }, { $set: { [`unread.${key}`]: 0 } }),
  ]);

  return { threadId: thread._id, unreadCount: 0 };
}

async function getUnreadTotal({ userId, role }) {
  const key = role === ROLES.HOST ? 'host' : 'driver';
  const match = role === ROLES.HOST ? { hostId: userId } : { driverId: userId };

  const rows = await ChatThread.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: `$unread.${key}` } } },
  ]);

  return { unreadTotal: rows[0]?.total || 0 };
}

module.exports = {
  ensureThread,
  loadThread,
  listThreads,
  getMessages,
  sendMessage,
  markRead,
  getUnreadTotal,
  MAX_LENGTH,
  PARTICIPANT_FIELDS,
};
