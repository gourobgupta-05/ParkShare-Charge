/**
 * Nav links owned by Maidul Islam [MI].
 */
import { ROLES } from '@/lib/constants';

const links = [
  { href: '/chat', label: 'Messages', roles: [ROLES.DRIVER, ROLES.HOST], owner: 'MI' },
  { href: '/host/energy', label: 'Energy logs', roles: [ROLES.HOST], owner: 'MI' },
  { href: '/admin/promos', label: 'Promo codes', roles: [ROLES.ADMIN], owner: 'MI' },
];

export default links;
