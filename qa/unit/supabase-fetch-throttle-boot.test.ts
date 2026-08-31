import { describe, expect, it, beforeEach } from "vitest";
import {
  isLoginBootInProgress,
  markLoginBootComplete,
  markLoginBootStart,
  resetEgressMonitor,
} from "@/lib/monitoring/supabase-egress-monitor";

describe("login boot egress window", () => {
  beforeEach(() => {
    resetEgressMonitor();
    markLoginBootComplete();
  });

  it("isLoginBootInProgress is true between start and complete", () => {
    expect(isLoginBootInProgress()).toBe(false);
    markLoginBootStart();
    expect(isLoginBootInProgress()).toBe(true);
    markLoginBootComplete();
    expect(isLoginBootInProgress()).toBe(false);
  });
});
