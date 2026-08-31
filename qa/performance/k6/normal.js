import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.QA_BASE_URL || "http://localhost:3000";

export const options = {
  stages: [
    { duration: "1m", target: 10 },
    { duration: "3m", target: 10 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<2500"],
  },
};

export default function () {
  const res = http.get(`${BASE}/`);
  check(res, { "home ok": (r) => r.status < 400 });
  sleep(0.5);
}
