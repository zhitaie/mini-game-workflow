import { createAnalyticsManager } from '../packages/game-core-client/dist/game-core-client/src/analytics/createAnalyticsManager.js';

let requestCount = 0;
const sentBatches = [];
const analytics = createAnalyticsManager({
  async request(options) {
    requestCount += 1;
    sentBatches.push(options.body.events);

    if (requestCount === 1) {
      throw new Error('simulated analytics outage');
    }

    return undefined;
  }
});

analytics.init({
  gameKey: 'game_sample',
  platform: 'web',
  clientVersion: '0.1.0',
  sessionId: 'verify-analytics-retry'
});
analytics.track({ eventName: 'first' });

let firstFlushFailed = false;
try {
  await analytics.flush();
} catch {
  firstFlushFailed = true;
}

if (!firstFlushFailed) {
  throw new Error('Expected the first analytics flush to fail.');
}

analytics.track({ eventName: 'second' });
await analytics.flush();

const retryBatch = sentBatches[1];
if (
  requestCount !== 2 ||
  !retryBatch ||
  retryBatch.length !== 2 ||
  retryBatch[0]?.eventName !== 'first' ||
  retryBatch[1]?.eventName !== 'second'
) {
  throw new Error(`Expected retry to preserve both events: ${JSON.stringify(sentBatches)}`);
}

console.log(JSON.stringify({ requestCount, retryBatch }, null, 2));
