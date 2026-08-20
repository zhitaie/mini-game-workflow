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

const concurrentBatches = [];
const deliveryResolvers = [];
const concurrentAnalytics = createAnalyticsManager({
  request(options) {
    concurrentBatches.push(options.body.events);
    return new Promise((resolve) => {
      deliveryResolvers.push(resolve);
    });
  }
});

concurrentAnalytics.init({
  gameKey: 'game_sample',
  platform: 'web',
  clientVersion: '0.1.0',
  sessionId: 'verify-analytics-concurrency'
});
concurrentAnalytics.track({ eventName: 'concurrent-first' });

const firstFlush = concurrentAnalytics.flush();
const secondFlush = concurrentAnalytics.flush();
if (concurrentBatches.length !== 1 || concurrentBatches[0]?.[0]?.eventName !== 'concurrent-first') {
  throw new Error(`Expected concurrent flushes to share one first delivery: ${JSON.stringify(concurrentBatches)}`);
}

concurrentAnalytics.track({ eventName: 'queued-during-delivery' });
deliveryResolvers[0]();
await new Promise((resolve) => setImmediate(resolve));

if (
  concurrentBatches.length !== 2 ||
  concurrentBatches[1]?.length !== 1 ||
  concurrentBatches[1]?.[0]?.eventName !== 'queued-during-delivery'
) {
  throw new Error(`Expected queued event to be delivered once after the active batch: ${JSON.stringify(concurrentBatches)}`);
}

deliveryResolvers[1]();
await Promise.all([firstFlush, secondFlush]);

console.log(JSON.stringify({ requestCount, retryBatch, concurrentBatches }, null, 2));
