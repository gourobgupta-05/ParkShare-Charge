/**
 * Nav links owned by Gourob Gupta [GG].
 */
import { ROLES } from '@/lib/constants';

const links = [
  { href: '/bookings', label: 'Bookings', roles: [ROLES.DRIVER, ROLES.HOST], owner: 'GG' },
  { href: '/host/availability', label: 'Availability', roles: [ROLES.HOST], owner: 'GG' },
  { href: '/host/reviews', label: 'Reviews', roles: [ROLES.HOST], owner: 'GG' },
  { href: '/admin/tariffs', label: 'Electricity tariffs', roles: [ROLES.ADMIN], owner: 'GG' },
];

export default links;
