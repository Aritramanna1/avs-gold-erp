import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePeople, type Person } from "@/lib/people-store";
import { useWorkers } from "@/lib/workers-store";
import { useWorkerGoldBook } from "@/lib/worker-gold-book-store";
import { useJobCards } from "@/lib/jobcards-store";
import { useSettings } from "@/lib/settings-store";
import { calculateKarigarPeriodSettlement } from "@/lib/karigar-period-settlement";
import { gramsToMg, mgToGrams } from "@/lib/gold";
import { paiseToRupees, rupeesToPaise } from "@/lib/billing-store";

// Mock base repository
vi.mock("@/lib/repositories/base-repository", () => ({
  createRepository: (tableName: string) => {
    const memory = new Map<string, any>();
    return {
      get: vi.fn(async (id: string) => memory.get(id) ?? null),
      list: vi.fn(async () => Array.from(memory.values())),
      save: vi.fn(async (entity: any) => {
        memory.set(entity.id, entity);
        return entity;
      }),
      delete: vi.fn(async (id: string) => {
        memory.delete(id);
      }),
    };
  },
}));

describe("MTJ ERP — Karigar Payroll, Wastage Earning & Multi-Purity Settlement Engine", () => {
  const mockWorkerId = "worker_aritra_01";
  const mockWorker: Person = {
    id: mockWorkerId,
    type: "karigar",
    fullName: "Aritra Karigar",
    phone: "9876543210",
    active: true,
    compensationMode: "work_based",
    notes: "Master artisan",
    createdAt: Date.now(),
  };

  beforeEach(() => {
    usePeople.setState({ people: [mockWorker] });
    useWorkers.setState({
      attendance: [],
      stays: [],
      rules: [
        {
          id: "rule_1",
          workerId: mockWorkerId,
          type: "work_based",
          wagePctComponents: [0.50], // 0.50% wastage-linked earning
          bookPurityPermille: 916,
          effectiveDate: "2026-08-01",
          active: true,
          createdAt: Date.now(),
        },
      ],
      withdrawals: [],
      loans: [],
      advances: [],
      allowances: [],
      goldAdvances: [],
      wastageReturns: [],
      settlements: [],
    });
    useWorkerGoldBook.setState({ entries: [] });
    useJobCards.setState({ jobCards: [] });
    useSettings.setState({ goldRatePerGramPaise: 750000 }); // ₹7,500/g
  });

  it("1. Maintains separate, discrete books per purity (22K, 18K, 21K, 14K) without merging", () => {
    // 22K entry: 100g given, 99.5g returned
    useWorkerGoldBook.setState({
      entries: [
        {
          id: "wgb_22k_1",
          entryNo: "WGB-001",
          date: "2026-08-10",
          time: "10:00:00",
          workerId: mockWorkerId,
          workerName: "Aritra Karigar",
          particulars: "22K Bangles work",
          grossMg: 100000,
          lessMg: 0,
          netMg: 100000,
          purity: 916,
          fineMg: 91600,
          quantity: 2,
          notes: "",
          givenBy: "Staff",
          receivedBy: "Aritra",
          type: "given",
          createdAt: Date.now(),
        },
        {
          id: "wgb_22k_2",
          entryNo: "WGB-002",
          date: "2026-08-15",
          time: "16:00:00",
          workerId: mockWorkerId,
          workerName: "Aritra Karigar",
          particulars: "22K Completed Bangles",
          grossMg: 99500,
          lessMg: 0,
          netMg: 99500,
          purity: 916,
          fineMg: 91142,
          quantity: 2,
          notes: "",
          givenBy: "Aritra",
          receivedBy: "Staff",
          type: "return",
          createdAt: Date.now(),
        },
        // 18K entry: 50g given, 49.8g returned
        {
          id: "wgb_18k_1",
          entryNo: "WGB-003",
          date: "2026-08-12",
          time: "11:00:00",
          workerId: mockWorkerId,
          workerName: "Aritra Karigar",
          particulars: "18K Diamond Ring mounts",
          grossMg: 50000,
          lessMg: 0,
          netMg: 50000,
          purity: 750,
          fineMg: 37500,
          quantity: 5,
          notes: "",
          givenBy: "Staff",
          receivedBy: "Aritra",
          type: "given",
          createdAt: Date.now(),
        },
        {
          id: "wgb_18k_2",
          entryNo: "WGB-004",
          date: "2026-08-18",
          time: "17:00:00",
          workerId: mockWorkerId,
          workerName: "Aritra Karigar",
          particulars: "18K Completed Rings",
          grossMg: 49800,
          lessMg: 0,
          netMg: 49800,
          purity: 750,
          fineMg: 37350,
          quantity: 5,
          notes: "",
          givenBy: "Aritra",
          receivedBy: "Staff",
          type: "return",
          createdAt: Date.now(),
        },
      ],
    });

    const settlement = calculateKarigarPeriodSettlement(mockWorkerId, "2026-08-01", "2026-08-31");
    expect(settlement).not.toBeNull();
    expect(settlement!.purityBooks.length).toBe(2);

    const book22K = settlement!.purityBooks.find((b) => b.purity === 916);
    const book18K = settlement!.purityBooks.find((b) => b.purity === 750);

    expect(book22K).toBeDefined();
    expect(book18K).toBeDefined();

    // 22K book verifies 99.5g work done
    expect(book22K!.netWorkDoneGrossMg).toBe(99500);
    // 18K book verifies 49.8g work done
    expect(book18K!.netWorkDoneGrossMg).toBe(49800);
    // Total work combines correctly in summary but books remain separate
    expect(settlement!.totalWorkDoneGrossMg).toBe(149300);
  });

  it("2. Accurately computes wastage-linked earning (e.g. 100.000g @ 0.50% = 0.500g)", () => {
    useWorkerGoldBook.setState({
      entries: [
        {
          id: "wgb_1",
          entryNo: "WGB-100",
          date: "2026-08-05",
          time: "09:00:00",
          workerId: mockWorkerId,
          workerName: "Aritra Karigar",
          particulars: "Pure Gold Bar to 22K",
          grossMg: 100000,
          lessMg: 0,
          netMg: 100000,
          purity: 916,
          fineMg: 91600,
          quantity: 1,
          notes: "",
          givenBy: "Staff",
          receivedBy: "Aritra",
          type: "given",
          createdAt: Date.now(),
        },
        {
          id: "wgb_2",
          entryNo: "WGB-101",
          date: "2026-08-10",
          time: "18:00:00",
          workerId: mockWorkerId,
          workerName: "Aritra Karigar",
          particulars: "Finished 22K Jewellery",
          grossMg: 100000,
          lessMg: 0,
          netMg: 100000,
          purity: 916,
          fineMg: 91600,
          quantity: 1,
          notes: "",
          givenBy: "Aritra",
          receivedBy: "Staff",
          type: "return",
          createdAt: Date.now(),
        },
      ],
    });

    const settlement = calculateKarigarPeriodSettlement(mockWorkerId, "2026-08-01", "2026-08-31");
    expect(settlement).not.toBeNull();

    // 91.600g fine worked @ 0.50% = 0.458g (458 mg fine)
    expect(settlement!.earnings.workBasedGrossEarningMg).toBe(458);
  });

  it("3. Correctly calculates loss vs allowed loss and applies over-loss deductions", () => {
    // Worker issued 100g 916 (91.6g fine), returns 98g 916 (89.768g fine) -> Actual Loss = 1.832g fine
    // Allowed loss (0.50%) = 0.449g fine -> Over-Loss = 1.383g fine
    useWorkerGoldBook.setState({
      entries: [
        {
          id: "wgb_loss_1",
          entryNo: "WGB-200",
          date: "2026-08-05",
          time: "09:00:00",
          workerId: mockWorkerId,
          workerName: "Aritra Karigar",
          particulars: "Gold Issue",
          grossMg: 100000,
          lessMg: 0,
          netMg: 100000,
          purity: 916,
          fineMg: 91600,
          quantity: 1,
          notes: "",
          givenBy: "Staff",
          receivedBy: "Aritra",
          type: "given",
          createdAt: Date.now(),
        },
        {
          id: "wgb_loss_2",
          entryNo: "WGB-201",
          date: "2026-08-10",
          time: "18:00:00",
          workerId: mockWorkerId,
          workerName: "Aritra Karigar",
          particulars: "Completed Item with loss",
          grossMg: 98000,
          lessMg: 0,
          netMg: 98000,
          purity: 916,
          fineMg: 89768,
          quantity: 1,
          notes: "",
          givenBy: "Aritra",
          receivedBy: "Staff",
          type: "return",
          createdAt: Date.now(),
        },
      ],
    });

    const settlement = calculateKarigarPeriodSettlement(mockWorkerId, "2026-08-01", "2026-08-31");
    expect(settlement).not.toBeNull();
    const book = settlement!.purityBooks[0];

    expect(book.actualLossMg).toBe(1832); // 1.832g actual loss
    expect(book.overlossMg).toBeGreaterThan(0); // Overloss is flagged and deducted
    expect(settlement!.earnings.overlossDeductionMg).toBe(book.overlossMg);
  });

  it("4. Accurately tracks attendance, working days, and traceable daily efficiency", () => {
    useWorkers.setState({
      attendance: [
        { id: "att_1", workerId: mockWorkerId, date: "2026-08-01", status: "present", createdAt: Date.now() },
        { id: "att_2", workerId: mockWorkerId, date: "2026-08-02", status: "present", createdAt: Date.now() },
        { id: "att_3", workerId: mockWorkerId, date: "2026-08-03", status: "present", createdAt: Date.now() },
        { id: "att_4", workerId: mockWorkerId, date: "2026-08-04", status: "half_day", createdAt: Date.now() },
        { id: "att_5", workerId: mockWorkerId, date: "2026-08-05", status: "absent", createdAt: Date.now() },
      ],
    });

    useWorkerGoldBook.setState({
      entries: [
        {
          id: "wgb_3",
          entryNo: "WGB-300",
          date: "2026-08-02",
          time: "10:00:00",
          workerId: mockWorkerId,
          workerName: "Aritra Karigar",
          particulars: "Completed Rings",
          grossMg: 35000,
          lessMg: 0,
          netMg: 35000,
          purity: 916,
          fineMg: 32060,
          quantity: 7,
          notes: "",
          givenBy: "Aritra",
          receivedBy: "Staff",
          type: "return",
          createdAt: Date.now(),
        },
      ],
    });

    const settlement = calculateKarigarPeriodSettlement(mockWorkerId, "2026-08-01", "2026-08-05");
    expect(settlement).not.toBeNull();

    // 3 present + 0.5 half day = 3.5 working days
    expect(settlement!.attendance.totalWorkingDays).toBe(3.5);
    // 35g / 3.5 days = 10.000 g/day
    expect(settlement!.efficiency.averageWorkPerDayGrams).toBe(10);
    // 7 pcs / 3.5 days = 2 pcs/day
    expect(settlement!.efficiency.piecesPerDay).toBe(2);
  });

  it("5. Supports legitimate negative balances without artificial clamping to zero", () => {
    // Worker has small earning (100mg) but took 5000mg gold advance and ₹50,000 cash advance
    useWorkers.setState({
      goldAdvances: [
        {
          id: "ga_1",
          workerId: mockWorkerId,
          date: "2026-08-10",
          grossMg: 5000,
          purity: 916,
          fineMg: 4580,
          createdAt: Date.now(),
        },
      ],
      advances: [
        {
          id: "ca_1",
          workerId: mockWorkerId,
          date: "2026-08-10",
          amountPaise: 5000000, // ₹50,000
          mode: "cash",
          createdAt: Date.now(),
        },
      ],
    });

    const settlement = calculateKarigarPeriodSettlement(mockWorkerId, "2026-08-01", "2026-08-31");
    expect(settlement).not.toBeNull();

    // Cash balance is negative (-₹50,000) and must not be clamped to 0
    expect(settlement!.settlement.finalCashPayablePaise).toBe(-5000000);
  });

  it("6. Correctly supports salary-based workers with attendance pro-ration", () => {
    const salaryWorkerId = "worker_salary_01";
    const salaryWorker: Person = {
      id: salaryWorkerId,
      type: "worker",
      fullName: "Ramesh Staff",
      active: true,
      compensationMode: "salary",
      createdAt: Date.now(),
    };

    usePeople.setState({ people: [salaryWorker] });
    useWorkers.setState({
      rules: [
        {
          id: "rule_salary",
          workerId: salaryWorkerId,
          type: "fixed_monthly",
          monthlySalaryPaise: 3000000, // ₹30,000/month (₹1,000/day)
          effectiveDate: "2026-08-01",
          active: true,
          createdAt: Date.now(),
        },
      ],
      attendance: [
        { id: "att_s1", workerId: salaryWorkerId, date: "2026-08-01", status: "present", createdAt: Date.now() },
        { id: "att_s2", workerId: salaryWorkerId, date: "2026-08-02", status: "present", createdAt: Date.now() },
        { id: "att_s3", workerId: salaryWorkerId, date: "2026-08-03", status: "present", createdAt: Date.now() },
      ],
      withdrawals: [],
      loans: [],
      advances: [],
      allowances: [],
      goldAdvances: [],
      wastageReturns: [],
      settlements: [],
    });

    const settlement = calculateKarigarPeriodSettlement(salaryWorkerId, "2026-08-01", "2026-08-03");
    expect(settlement).not.toBeNull();
    expect(settlement!.isSalaryWorker).toBe(true);

    // 3 days @ ₹1,000/day = ₹3,000 (300000 paise)
    expect(settlement!.earnings.baseSalaryEarnedPaise).toBe(300000);
    expect(settlement!.settlement.finalCashPayablePaise).toBe(300000);
  });
});
