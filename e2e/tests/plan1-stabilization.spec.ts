import { test, expect } from "../fixtures/base";

// These dev-only globals (see src/routes/__root.tsx's DEV useEffect block)
// aren't part of the app's real public API, so they're declared here rather
// than in src/ — this file is the only place that needs to know about them.
declare global {
  interface Window {
    __auditLog: any;
    __localDb: any;
    __deviceRegistry: any;
    __sessionLock: any;
    __commQueue: any;
    __commService: any;
    __automationSettings: any;
    __printQueue: any;
    __goldRecon: any;
    __hardwareService: any;
  }
}

/**
 * Plan 1 Stabilization (Priority 8) — permanent regression coverage for the
 * offline-first migration's later phases (Step 8 Enterprise Security, Step 9
 * Communication Engine, Priority 5 Print Queue, Priority 6 Gold
 * Reconciliation, Priority 7 Hardware fallbacks, Priority 4 keyboard-first).
 *
 * These exercise the window.__* dev-only hooks installed in
 * src/routes/__root.tsx (DEV builds only — see that file's useEffect block),
 * the same surface used during each feature's original validation, now kept
 * as a permanent suite instead of a throwaway script.
 */

test.describe("Enterprise Security (Step 8)", () => {
  test("audit log is hash-chained and detects tampering", async ({ authedPage: page }) => {
    await page.waitForFunction(() => !!window.__auditLog, { timeout: 15000 });

    const e1 = await page.evaluate(() =>
      window.__auditLog.append({
        actorId: "e2e-user",
        actorEmail: "e2e@example.com",
        action: "e2e.test",
        entityType: "e2e_stabilization",
        entityId: "rec-1",
        before: null,
        after: { total: 100 },
      }),
    );
    const e2 = await page.evaluate(() =>
      window.__auditLog.append({
        actorId: "e2e-user",
        actorEmail: "e2e@example.com",
        action: "e2e.test",
        entityType: "e2e_stabilization",
        entityId: "rec-1",
        before: { total: 100 },
        after: { total: 200 },
      }),
    );
    expect(e2.prevHash).toBe(e1.hash);

    const cleanChain = await page.evaluate(() => window.__auditLog.verifyAuditChain());
    expect(cleanChain.ok).toBe(true);

    // Intercept Supabase API calls to simulate tampering in-memory without modifying the DB
    let simulateTamperedResponse = false;
    await page.route("**/rest/v1/audit_log*", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      if (simulateTamperedResponse) {
        // Alter after_json of the second row to trigger a verification failure
        const row = json.find((r: any) => r.id === e2.id);
        if (row) {
          row.after_json = JSON.stringify({ total: 1 });
        }
      }
      await route.fulfill({ response, json });
    });

    simulateTamperedResponse = true;
    const tamperedChain = await page.evaluate(() => window.__auditLog.verifyAuditChain());
    expect(tamperedChain.ok).toBe(false);
    expect(tamperedChain.brokenAtSeq).not.toBeNull();

    // Restore (stop simulating tampered response)
    simulateTamperedResponse = false;
    const healedChain = await page.evaluate(() => window.__auditLog.verifyAuditChain());
    expect(healedChain.ok).toBe(true);
  });

  test("device registration is stable and trust can be revoked", async ({ authedPage: page }) => {
    await page.waitForFunction(() => !!window.__deviceRegistry, { timeout: 15000 });
    const id1 = await page.evaluate(() => window.__deviceRegistry.getOrCreateDeviceId());
    const id2 = await page.evaluate(() => window.__deviceRegistry.getOrCreateDeviceId());
    expect(id1).toBe(id2);

    const registered = await page.evaluate(() =>
      window.__deviceRegistry.registerThisDevice("E2E Runner"),
    );
    expect(registered.trusted).toBe(true);

    await page.evaluate((id) => window.__deviceRegistry.setDeviceTrust(id, false), id1);
    const devices = await page.evaluate(() => window.__deviceRegistry.listRegisteredDevices());
    expect(devices.find((d: any) => d.deviceId === id1)?.trusted).toBe(false);

    // Restore so the dev machine doesn't stay flagged untrusted between runs.
    await page.evaluate((id) => window.__deviceRegistry.setDeviceTrust(id, true), id1);
  });

  test("session lock overlay blocks the app until unlocked", async ({ authedPage: page }) => {
    await page.waitForFunction(() => !!window.__sessionLock, { timeout: 15000 });
    expect(await page.evaluate(() => window.__sessionLock.useSessionLock.getState().locked)).toBe(
      false,
    );

    await page.evaluate(() => window.__sessionLock.useSessionLock.getState().lockNow());
    await expect(page.getByText("Session Locked")).toBeVisible();

    // Reset state for any later test in this worker.
    await page.evaluate(() => window.__sessionLock.useSessionLock.setState({ locked: false }));
  });
});

test.describe("Communication Engine (Step 9)", () => {
  test("failed sends are durably queued, retried with backoff, and eventually delivered", async ({
    authedPage: page,
  }) => {
    await page.waitForFunction(() => !!window.__commQueue && !!window.__commService, {
      timeout: 15000,
    });

    const fakeReq = {
      channel: "email" as const,
      template: "invoice" as const,
      branchId: "e2e-branch",
      recipient: { name: "E2E", email: "e2e@example.com" },
      linkedId: "e2e-invoice-1",
      linkedType: "invoice" as const,
    };

    const id = await page.evaluate((req) => window.__commQueue.enqueueForRetry(req), fakeReq);

    await page.evaluate(() => {
      (window as any).__e2eRealSend = window.__commService.send.bind(window.__commService);
      window.__commService.send = async () => ({
        success: false,
        provider: "e2e_fail",
        channel: "email",
        error: "e2e simulated failure",
        status: "failed",
      });
    });

    const drain1 = await page.evaluate(() => window.__commQueue.drainCommQueue());
    expect(drain1.sent).toBe(0);
    const afterFail = await page.evaluate(
      (jobId) =>
        window.__commQueue
          .getQueueEntries()
          .then((rows: any[]) => rows.find((r: any) => r.id === jobId)),
      id,
    );
    expect(afterFail.status).toBe("pending");
    expect(afterFail.attempts).toBe(1);

    await page.evaluate(() => {
      window.__commService.send = async (req: any) => ({
        success: true,
        provider: "e2e_recovered",
        channel: req.channel,
        status: "sent",
      });
    });
    await page.waitForTimeout(2200); // past the first backoff step (2s)

    const drain2 = await page.evaluate(() => window.__commQueue.drainCommQueue());
    expect(drain2.sent).toBeGreaterThanOrEqual(1);

    const afterRecover = await page.evaluate(
      (jobId) =>
        window.__commQueue
          .getQueueEntries()
          .then((rows: any[]) => rows.find((r: any) => r.id === jobId)),
      id,
    );
    expect(afterRecover.status).toBe("sent");

    await page.evaluate(() => {
      window.__commService.send = (window as any).__e2eRealSend;
    });
  });

  test("automation settings toggle gates event-driven sends", async ({ authedPage: page }) => {
    await page.waitForFunction(() => !!window.__automationSettings && !!window.__commService, {
      timeout: 15000,
    });

    await page.evaluate(() => {
      (window as any).__e2eRealSend = window.__commService.send.bind(window.__commService);
      (window as any).__e2eSendCalls = [];
      window.__commService.send = async (req: any) => {
        (window as any).__e2eSendCalls.push(req);
        return { success: true, provider: "e2e", channel: req.channel, status: "sent" };
      };
    });

    const emitBusinessEvent = await page.evaluate(async () => {
      const modPath = "/src/lib/comm/comm-automation.ts";
      const mod = await import(/* @vite-ignore */ modPath);
      (window as any).__e2eEmit = mod.emitBusinessEvent;
      return true;
    });
    expect(emitBusinessEvent).toBe(true);

    await page.evaluate(() =>
      window.__automationSettings.useAutomationSettings
        .getState()
        .setRule("invoice_created", { enabled: false }),
    );
    await page.evaluate(() =>
      (window as any).__e2eEmit("invoice_created", {
        branchId: "e2e",
        recipient: { name: "E2E", email: "e2e@example.com" },
        linkedId: "id-1",
        linkedType: "invoice",
      }),
    );
    expect(await page.evaluate(() => (window as any).__e2eSendCalls.length)).toBe(0);

    await page.evaluate(() =>
      window.__automationSettings.useAutomationSettings
        .getState()
        .setRule("invoice_created", { enabled: true, channels: ["email"] }),
    );
    await page.evaluate(() =>
      (window as any).__e2eEmit("invoice_created", {
        branchId: "e2e",
        recipient: { name: "E2E", email: "e2e@example.com" },
        linkedId: "id-1",
        linkedType: "invoice",
      }),
    );
    expect(await page.evaluate(() => (window as any).__e2eSendCalls.length)).toBe(1);

    await page.evaluate(() => {
      window.__commService.send = (window as any).__e2eRealSend;
    });
  });
});

test.describe("Print Job Queue (Priority 5)", () => {
  test("printing without a physical printer always falls back to a downloaded PDF", async ({
    authedPage: page,
  }) => {
    await page.waitForFunction(() => !!window.__printQueue, { timeout: 15000 });

    const [download, result] = await Promise.all([
      page.waitForEvent("download"),
      page.evaluate(() =>
        window.__printQueue.submitPrintJob({
          docType: "tag",
          title: "E2E Tag",
          tagData: { itemName: "E2E Item", barcode: "1112223334445", grossMg: 1000, purity: "22K" },
        }),
      ),
    ]);
    expect(result.status).toBe("pdf_fallback");
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    const history = await page.evaluate(() => window.__printQueue.getPrintJobHistory());
    expect(history.some((h: any) => h.id === result.jobId && h.status === "pdf_fallback")).toBe(
      true,
    );
  });
});

test.describe("Gold Reconciliation Engine (Priority 6)", () => {
  test("flags a real fine-gold discrepancy and ties it to the audit log", async ({
    authedPage: page,
  }) => {
    await page.waitForFunction(() => !!window.__goldRecon && !!window.__auditLog, {
      timeout: 15000,
    });

    const bill = {
      id: "e2e-bill-exception",
      billNo: "E2E-MB-1",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: "finalised",
      branchId: "e2e",
      jobCardId: "jc",
      jobNo: "J",
      orderId: "o",
      orderNo: "O",
      customerId: "c",
      customerName: "E2E Customer",
      itemName: "Ring",
      category: "Ring",
      pcs: 1,
      goldIssuedGrossMg: 10000,
      goldIssuedPurity: 916,
      goldIssuedFineMg: 10000,
      goldIssueSlipNo: "S",
      pEntries: [],
      finishedGrossMg: 9000,
      finishedPurity: 916,
      finishedFineMg: 9400, // 100mg short — a real exception
      mpEntries: [],
      actualWastageFineMg: 500,
      actualWastagePct: 5,
    };

    await page.waitForFunction(() => !!(window as any).__mfgBillStore);
    await page.evaluate((bill) => {
      // Uses the app's real manufacturing-bill-store singleton (exposed by
      // __root.tsx) — NOT a separate raw-path dynamic import, which would
      // silently create a second, disconnected store instance that
      // window.__goldRecon.runGoldReconciliation() never reads from.
      const mod = (window as any).__mfgBillStore;
      mod.useMfgBills.setState({ bills: [bill] });
    }, bill);

    const report = await page.evaluate(() => window.__goldRecon.runGoldReconciliation());
    expect(report.exceptionCount).toBe(1);
    expect(report.exceptions[0].billId).toBe("e2e-bill-exception");

    const auditEntries = await page.evaluate(() =>
      window.__auditLog.getAuditEntries({
        entityType: "manufacturing_bills",
        entityId: "e2e-bill-exception",
      }),
    );
    expect(auditEntries.some((e: any) => e.action === "gold_reconciliation.exception")).toBe(true);
  });
});

test.describe("Keyboard-first workflow (Priority 4)", () => {
  test("Ctrl+F/Ctrl+K opens the global command palette; Esc closes it", async ({
    authedPage: page,
  }) => {
    await expect(page.locator("[cmdk-input]")).not.toBeVisible();

    await page.keyboard.press("Control+f");
    await expect(page.locator("[cmdk-input]")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("[cmdk-input]")).not.toBeVisible();

    await page.keyboard.press("Control+k");
    await expect(page.locator("[cmdk-input]")).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

test.describe("Hardware manual fallback (Priority 7)", () => {
  test("manual barcode entry and scale-absent detection behave correctly", async ({
    authedPage: page,
  }) => {
    await page.waitForFunction(() => !!window.__hardwareService, { timeout: 15000 });

    const scanned = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const unsub = window.__hardwareService.onBarcodeScanned((code: string) => {
            unsub();
            resolve(code);
          });
          window.__hardwareService.triggerBarcodeScanned("9998887776665");
        }),
    );
    expect(scanned).toBe("9998887776665");

    const scaleConnected = await page.evaluate(() => window.__hardwareService.isScaleConnected);
    expect(scaleConnected).toBe(false); // no physical scale in CI — correctly reported, not assumed present
  });
});
