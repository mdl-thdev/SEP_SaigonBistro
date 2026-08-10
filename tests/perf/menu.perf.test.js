// tests/perf/menu.perf.test.js
// k6 run tests/perf/menu.perf.test.js
// k6 performance test for GET /api/menu
// Verifies system stability and latency under concurrent traffic
// Prerequisite: backend must be running, e.g.
//   npm run dev:backend   (assumed at http://localhost:3000)

import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  // Simulate 20 concurrent Virtual Users
  vus: 20,

  // Run for 30 seconds
  duration: "30s",

  // Threshold: 95% of requests must complete under 500ms.
  // If this threshold is breached, k6 exits with a non-zero status code -
  // useful for CI pipelines that should fail the build on a perf regression.
  thresholds: {
    http_req_duration: ["p(95)<500"],
    checks: ["rate>0.95"], // at least 95% of checks (status 200) must pass
  },
};

const BASE_URL = "http://localhost:3000";

export default function () {
  const res = http.get(`${BASE_URL}/api/menu`);

  // Check: verify each response is actually successful, not just fast
  check(res, {
    "status is 200": (r) => r.status === 200,
    "response has categories": (r) => JSON.parse(r.body).categories !== undefined,
    "response has items": (r) => JSON.parse(r.body).items !== undefined,
  });

  sleep(1); // pace requests to mimic realistic user behavior between calls
}