/**
 * Nav links owned by S. Moontaha Rahman [SMR].
 */
import { ROLES } from '@/lib/constants';

const links = [
  { href: '/host/verification', label: 'Verification', roles: [ROLES.HOST], owner: 'SMR' },
  { href: '/host/spaces', label: 'Your spaces', roles: [ROLES.HOST], owner: 'SMR' },
  { href: '/host/earnings', label: 'Earnings', roles: [ROLES.HOST], owner: 'SMR' },
  { href: '/host/scan-pass', label: 'Check in a driver', roles: [ROLES.HOST], owner: 'SMR' },
  { href: '/admin/host-verifications', label: 'Host verifications', roles: [ROLES.ADMIN], owner: 'SMR' },
  { href: '/admin/commission', label: 'Commission & payouts', roles: [ROLES.ADMIN], owner: 'SMR' },
];

export default links;
