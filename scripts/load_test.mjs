import http from 'http';
import dotenv from 'dotenv';
dotenv.config({ path: 'apps/api/.env' });

const TARGET_HOST = process.env.LOAD_TEST_HOST || '127.0.0.1';
const TARGET_PORT = process.env.PORT || 4000;
const BASE_URL = `http://${TARGET_HOST}:${TARGET_PORT}`;

// Test token (uses standard testing demo session token)
const AUTH_HEADER = 'Bearer demo-session-load-test-token';

function makeRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Authorization': AUTH_HEADER,
      'x-correlation-id': `load-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      ...headers
    };

    const req = http.request({
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path,
      method,
      headers: reqHeaders,
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Math.round(performance.now() - t0);
        resolve({
          statusCode: res.statusCode,
          duration,
          is429: res.statusCode === 429,
          isError: res.statusCode >= 500
        });
      });
    });

    req.on('error', () => {
      const duration = Math.round(performance.now() - t0);
      resolve({
        statusCode: 0,
        duration,
        is429: false,
        isError: true
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const duration = Math.round(performance.now() - t0);
      resolve({
        statusCode: 504,
        duration,
        is429: false,
        isError: true
      });
    });

    if (payload) req.write(payload);
    req.end();
  });
}

const WORKFLOWS = [
  { path: '/api/health', method: 'GET' },
  { path: '/api/health/ready', method: 'GET' },
  { path: '/api/shops?limit=20', method: 'GET' },
  { path: '/api/products?limit=20', method: 'GET' },
  { path: '/api/records?limit=50', method: 'GET' }
];

async function runVirtualUser(iterations) {
  const results = [];
  for (let i = 0; i < iterations; i++) {
    const wf = WORKFLOWS[i % WORKFLOWS.length];
    const res = await makeRequest(wf.path, wf.method);
    results.push(res);
  }
  return results;
}

function calculateTierStats(allResults, durationSeconds) {
  const total = allResults.length;
  if (!total) return null;

  const latencies = allResults.map(r => r.duration).sort((a, b) => a - b);
  const total429 = allResults.filter(r => r.is429).length;
  const totalErrors = allResults.filter(r => r.isError).length;
  const sumLatency = latencies.reduce((a, b) => a + b, 0);

  const avg = Math.round(sumLatency / total);
  const median = latencies[Math.floor(total * 0.5)];
  const p95 = latencies[Math.floor(total * 0.95)] || latencies[total - 1];
  const p99 = latencies[Math.floor(total * 0.99)] || latencies[total - 1];
  const rps = Math.round((total / durationSeconds) * 10) / 10;
  const errorRate = Math.round((totalErrors / total) * 1000) / 10;
  const rate429 = Math.round((total429 / total) * 1000) / 10;

  return {
    totalRequests: total,
    rps,
    avgMs: avg,
    medianMs: median,
    p95Ms: p95,
    p99Ms: p99,
    errorRatePct: `${errorRate}%`,
    rateLimit429Pct: `${rate429}%`
  };
}

async function runScenario(vuCount, requestsPerVu) {
  console.log(`\n---------------------------------------------------------`);
  console.log(`Executing Scenario: ${vuCount} Concurrent VUs (${requestsPerVu} reqs/VU, Total: ${vuCount * requestsPerVu} reqs)`);
  console.log(`---------------------------------------------------------`);

  const t0 = performance.now();
  const vuPromises = [];
  for (let i = 0; i < vuCount; i++) {
    vuPromises.push(runVirtualUser(requestsPerVu));
  }

  const vuOutputs = await Promise.all(vuPromises);
  const durationSeconds = (performance.now() - t0) / 1000;
  const allResults = vuOutputs.flat();

  const stats = calculateTierStats(allResults, durationSeconds);
  console.log('Results:', JSON.stringify(stats, null, 2));
  return { vuCount, ...stats };
}

async function checkServerReady() {
  try {
    const res = await makeRequest('/api/health');
    return res.statusCode === 200;
  } catch {
    return false;
  }
}

async function main() {
  console.log('========================================================');
  console.log(`RTR WHOLESALE API REAL-WORLD LOAD TEST HARNESS`);
  console.log(`Target: ${BASE_URL}`);
  console.log('========================================================');

  const ready = await checkServerReady();
  if (!ready) {
    console.error(`\n❌ Target API server at ${BASE_URL} is not responding.`);
    console.error(`Please ensure the API server is running (e.g. npm run start or npm run dev in apps/api).`);
    process.exit(1);
  }

  console.log('✓ Target server responded healthy. Starting concurrency tiers...\n');

  const report = [];
  // Tier 1: Baseline (5 VUs)
  report.push(await runScenario(5, 10));

  // Tier 2: Normal Business Load (25 VUs)
  report.push(await runScenario(25, 8));

  // Tier 3: Moderate Wholesale Load (50 VUs)
  report.push(await runScenario(50, 6));

  // Tier 4: Higher Peak Load (100 VUs)
  report.push(await runScenario(100, 4));

  console.log('\n========================================================');
  console.log('FINAL LOAD TEST SUMMARY');
  console.log('========================================================');
  console.table(report);
}

main().catch(err => {
  console.error('Load test runner failed:', err);
  process.exit(1);
});
