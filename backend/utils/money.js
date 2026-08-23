/**
 * 🔒 ALL money in this project is an integer in POISHA (1 BDT = 100 poisha).
 * Division happens ONLY here. Never do float arithmetic on money in a feature.
 */
function takaToPoisha(taka) {
  return Math.round(Number(taka) * 100);
}
function poishaToTaka(poisha) {
  return Number(poisha) / 100;
}
/** '৳1,250.00' — display only. */
function formatPoisha(poisha) {
  return '৳' + poishaToTaka(poisha).toLocaleString('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
/** Percentage of an integer amount, rounded in the PLATFORM's favour. */
function percentOf(poisha, rate) {
  return Math.ceil(Number(poisha) * Number(rate));
}
/**
 * Split a gross amount into platform commission + host credit.
 * INVARIANT: commission + hostCredit === gross. Asserted, because a missing
 * 1 poisha in the split-payout transaction breaks the ledger.
 */
function splitCommission(grossPoisha, rate) {
  const commission = percentOf(grossPoisha, rate);
  const hostCredit = grossPoisha - commission;
  if (commission + hostCredit !== grossPoisha) {
    throw new Error(`Money split invariant broken for ${grossPoisha}`);
  }
  return { commissionPoisha: commission, hostCreditPoisha: hostCredit };
}
module.exports = { takaToPoisha, poishaToTaka, formatPoisha, percentOf, splitCommission };
