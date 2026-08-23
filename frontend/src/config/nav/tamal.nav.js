/**
 * Nav links owned by Tamal Deb Nath [TDN].
 */
import { ROLES } from '@/lib/constants';

const links = [
  { href: '/search', label: 'Find parking', roles: [ROLES.DRIVER], owner: 'TDN' },
  { href: '/wallet', label: 'Wallet', roles: [ROLES.DRIVER, ROLES.HOST], owner: 'TDN' },
  { href: '/host/hours', label: 'Opening hours', roles: [ROLES.HOST], owner: 'TDN' },
  { href: '/admin/disputes', label: 'Escrow & disputes', roles: [ROLES.ADMIN], owner: 'TDN' },
];

export default links;
