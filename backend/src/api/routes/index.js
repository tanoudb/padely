import { authProfileRoutes } from './authProfileRoutes.js';
import { matchRoutes } from './matchRoutes.js';
import { statsRoutes } from './statsRoutes.js';
import { communityRoutes } from './communityRoutes.js';
import { groupMarketplaceRoutes } from './groupMarketplaceRoutes.js';
import { gamificationPirAdminRoutes } from './gamificationPirAdminRoutes.js';

export const apiRoutes = [
  ...authProfileRoutes,
  ...matchRoutes,
  ...statsRoutes,
  ...communityRoutes,
  ...groupMarketplaceRoutes,
  ...gamificationPirAdminRoutes,
];
