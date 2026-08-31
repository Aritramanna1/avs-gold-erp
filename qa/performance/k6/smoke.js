import http from "k6/http";
import { check, sleep } from "k6";

/**
 * QA-07 k6 smoke — TEST/STAGING ONLY. Orchestrator runs staging-guard before this.
 * Does NOT hit Razorpay, Meta, Gmail, or external BSPs.
 */
const BASE = __ENV.QA_BASE_URL || __ENV.E2E_BASE_URL || "http://localhost:3000";

export const options = {
  vus: 2,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<3000"],
  },
};

export default function () {
  const routes = ["/", "/login", "/help"];
  for (const route of routes) {
    const res = http.get(`${BASE}${route}`);
    check(res, {
      "status 2xx/3xx": (r) => r.status >= 200 && r.status < 400,
      "not production block": () => !String(BASE).includes("maatarajewellers.shop"),
    });
  }
  sleep(1);
}
