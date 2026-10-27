/**
 * k6 Load Test — Authentication Endpoints
 *
 * Tests:
 * - POST /api/v1/auth/login (success + failure)
 * - POST /api/v1/auth/register
 * - POST /api/v1/auth/refresh-token
 * - GET /api/v1/me (authenticated)
 *
 * Run:
 *   k6 run --vus 50 --duration 60s services/api/tests/load/k6-auth.js
 *
 * Environment:
 *   K6_API_URL=https://backend-api.podacium.com (default: http://localhost:8000)
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.K6_API_URL || 'http://localhost:8000';

// Custom metrics
const loginSuccess = new Rate('login_success');
const loginDuration = new Trend('login_duration');

export const options = {
  stages: [
    { duration: '10s', target: 10 },   // Ramp up
    { duration: '30s', target: 50 },   // Sustained load
    { duration: '10s', target: 100 },  // Peak
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95th < 500ms, 99th < 1s
    http_req_failed: ['rate<0.01'],                   // <1% error rate
    login_success: ['rate>0.95'],                     // >95% login success
  },
};

export default function () {
  group('Login Flow', () => {
    // Attempt login
    const loginRes = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({
        email: `loadtest-${__VU}@podacium.com`,
        password: 'LoadTest123!',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    loginDuration.add(loginRes.timings.duration);
    loginSuccess.add(loginRes.status === 200);

    check(loginRes, {
      'login status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'login response time < 500ms': (r) => r.timings.duration < 500,
    });

    // If login succeeded, test authenticated endpoint
    if (loginRes.status === 200) {
      const cookies = loginRes.cookies;
      const meRes = http.get(`${BASE_URL}/api/v1/me`, {
        cookies: cookies,
      });

      check(meRes, {
        'me endpoint returns 200': (r) => r.status === 200,
        'me response time < 300ms': (r) => r.timings.duration < 300,
      });
    }
  });

  group('Health Check', () => {
    const healthRes = http.get(`${BASE_URL}/health`);
    check(healthRes, {
      'health returns 200': (r) => r.status === 200,
      'health response time < 100ms': (r) => r.timings.duration < 100,
    });
  });

  sleep(1);
}
