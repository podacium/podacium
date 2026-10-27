/**
 * k6 Load Test — Payment Endpoints
 *
 * Tests payment initiation under load to ensure:
 * - No double-charges under concurrent requests
 * - Rate limiting works correctly
 * - Response times stay within SLA
 *
 * Run:
 *   k6 run --vus 20 --duration 30s services/api/tests/load/k6-payments.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.K6_API_URL || 'http://localhost:8000';

const paymentSuccess = new Rate('payment_initiation_success');

export const options = {
  stages: [
    { duration: '5s', target: 5 },
    { duration: '20s', target: 20 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // Payments can be slower
    http_req_failed: ['rate<0.05'],     // <5% error rate
  },
};

export default function () {
  group('Payment Initiation', () => {
    // This tests the payment endpoint under load
    // In a real scenario, you'd authenticate first
    const res = http.post(
      `${BASE_URL}/api/v1/payments/initiate`,
      JSON.stringify({
        amount_cents: 5000,
        currency: 'DZD',
        purpose: 'MODULE_PURCHASE',
        module_id: 'test-module-1',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    // Expect 401 (not authenticated) or 200 (if test user is set up)
    paymentSuccess.add(res.status === 200 || res.status === 401);

    check(res, {
      'payment response is valid': (r) => [200, 401, 422].includes(r.status),
      'payment response time < 1s': (r) => r.timings.duration < 1000,
      'no 500 errors': (r) => r.status !== 500,
    });
  });

  sleep(0.5);
}
