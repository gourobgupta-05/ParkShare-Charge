/**
 * 🔒 THE response envelope. Every endpoint in this project returns this shape,
 * so frontend code can rely on `data` / `message` / `code` without guessing.
 *   { success: true,  data: {...}, message: 'OK' }
 *   { success: false, message: '...', code: 'SLOT_ALREADY_BOOKED', details: {} }
 */
function ok(res, data = null, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({ success: true, data, message });
}
function created(res, data = null, message = 'Created') {
  return ok(res, data, message, 201);
}
function paginated(res, items, { page, limit, total }, message = 'OK') {
  return res.status(200).json({
    success: true,
    data: { items, page, limit, total, pages: Math.ceil(total / limit) || 1 },
    message,
  });
}
module.exports = { ok, created, paginated };
