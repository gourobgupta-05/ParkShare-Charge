/**
 * 🔒 NAV REGISTRY — DO NOT EDIT AFTER INITIAL SETUP.
 * Each member owns their own nav file. This merges them, so adding a link never
 * causes a merge conflict.
 */
import tamal from './tamal.nav';
import gourob from './gourob.nav';
import maidul from './maidul.nav';
import moontaha from './moontaha.nav';

const ALL = [...tamal, ...gourob, ...maidul, ...moontaha];

/** Links visible to a given role, in declaration order. */
export function navForRole(role) {
  return ALL.filter((item) => item.roles.includes(role));
}

export default ALL;
