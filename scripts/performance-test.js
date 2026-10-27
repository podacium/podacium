import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const failureRate = new Rate('scenario_failures');
const loginDuration = new Trend('login_duration');
const coursesDuration = new Trend('courses_duration');
const quizDuration = new Trend('quiz_duration');
const certDuration = new Trend('cert_duration');
const videoDuration = new Trend('video_duration');

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.01'],
    scenario_failures: ['rate<0.05'],
    login_duration: ['p(95)<1500'],
    courses_duration: ['p(95)<2000'],
    quiz_duration: ['p(95)<2000'],
    cert_duration: ['p(95)<3000'],
    video_duration: ['p(95)<1000'],
  },
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      startTime: '0s',
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '1m', target: 0 },
      ],
      startTime: '35s',
    },
    stress: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      startTime: '5m30s',
    },
    soak: {
      executor: 'constant-vus',
      vus: 20,
      duration: '10m',
      startTime: '9m',
    },
  },
};

const CREDENTIALS = {
  email: __ENV.TEST_USER_EMAIL || 'test@podacium.com',
  password: __ENV.TEST_USER_PASSWORD || 'testpass123',
};

export function setup() {
  const host = __ENV.TARGET_HOST || 'http://localhost:8000';

  const loginRes = http.post(`${host}/api/v1/auth/login`, JSON.stringify({
    email: CREDENTIALS.email,
    password: CREDENTIALS.password,
  }), { headers: { 'Content-Type': 'application/json' } });

  if (loginRes.status !== 200) {
    fail(`setup: login failed (${loginRes.status})`);
  }

  return {
    token: loginRes.json('access_token'),
    host,
    courseId: __ENV.TEST_COURSE_ID || null,
  };
}

export default function (data) {
  const { host, token, courseId } = data;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const genericHeaders = { 'Content-Type': 'application/json' };

  group('auth: login', () => {
    const res = http.post(`${host}/api/v1/auth/login`, JSON.stringify({
      email: CREDENTIALS.email,
      password: CREDENTIALS.password,
    }), { headers: genericHeaders });
    loginDuration.add(res.timings.duration);
    const ok = check(res, {
      'login: status 200': (r) => r.status === 200,
      'login: has access_token': (r) => r.json('access_token') !== undefined,
      'login: response < 1.5s': (r) => r.timings.duration < 1500,
    });
    failureRate.add(!ok);
  });

  sleep(2 + Math.random());

  group('courses: list', () => {
    const res = http.get(`${host}/api/v1/courses`, { headers });
    coursesDuration.add(res.timings.duration);
    const ok = check(res, {
      'courses: status 200': (r) => r.status === 200,
      'courses: valid JSON array': (r) => Array.isArray(r.json()),
      'courses: response < 2s': (r) => r.timings.duration < 2000,
    });
    failureRate.add(!ok);
  });

  sleep(3 + Math.random());

  group('quiz: submit', () => {
    const payload = { answers: { q1: 'A', q2: 'B', q3: 'C' } };
    const url = courseId
      ? `${host}/api/v1/quiz/${courseId}/submit`
      : `${host}/api/v1/quiz/sample/submit`;
    const res = http.post(url, JSON.stringify(payload), { headers });
    quizDuration.add(res.timings.duration);
    const ok = check(res, {
      'quiz: status 200': (r) => r.status === 200,
      'quiz: has score': (r) => r.json('score') !== undefined,
      'quiz: response < 2s': (r) => r.timings.duration < 2000,
    });
    failureRate.add(!ok);
  });

  sleep(3 + Math.random());

  group('certificate: download', () => {
    const course = courseId || 'sample-course';
    const res = http.get(`${host}/api/v1/certificates/${course}/download`, { headers });
    certDuration.add(res.timings.duration);
    const ok = check(res, {
      'cert: status 200': (r) => r.status === 200,
      'cert: is PDF': (r) => (r.headers['Content-Type'] || '').includes('pdf') || (r.headers['content-type'] || '').includes('pdf'),
      'cert: response < 3s': (r) => r.timings.duration < 3000,
    });
    failureRate.add(!ok);
  });

  sleep(2 + Math.random());

  group('video: handshake', () => {
    const videoId = 'sample-video-001';
    const res = http.post(`${host}/api/v1/videos/${videoId}/handshake`, JSON.stringify({
      timestamp: Date.now(),
    }), { headers });
    videoDuration.add(res.timings.duration);
    const ok = check(res, {
      'video: status 200': (r) => r.status === 200,
      'video: has stream_url': (r) => r.json('stream_url') !== undefined,
      'video: response < 1s': (r) => r.timings.duration < 1000,
    });
    failureRate.add(!ok);
  });

  sleep(2 + Math.random());
}
