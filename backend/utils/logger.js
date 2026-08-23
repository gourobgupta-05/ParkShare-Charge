/** 🔒 Tiny console logger. Swap for pino later if you want. */
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
module.exports = {
  info: (m) => console.log(`[${stamp()}] INFO  ${m}`),
  warn: (m) => console.warn(`[${stamp()}] WARN  ${m}`),
  error: (m) => console.error(`[${stamp()}] ERROR ${m}`),
  debug: (m) => process.env.NODE_ENV !== 'production' && console.log(`[${stamp()}] DEBUG ${m}`),
};
