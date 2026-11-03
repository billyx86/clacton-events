import { onRequest } from 'firebase-functions/v2/https';

import { handleFeedRequest } from './feedHandler.js';

/**
 * Public, no-auth HTTP endpoint exposing upcoming Clacton events as JSON
 * (issue #28). The actual request handling — query, shaping, headers —
 * lives in feedHandler.js / feedShaper.js so it is unit-testable without
 * the firebase-functions framework.
 *
 * Deployed target: `publicEventsFeed`.
 */
export const publicEventsFeed = onRequest(handleFeedRequest);
