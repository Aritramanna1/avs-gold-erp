import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/providers/data-provider", () => ({
  dataProvider: { from: vi.fn() },
}));

vi.mock("@/lib/firm-scoped-query", () => ({
  resolveFirmIdForQuery: vi.fn(),
  withFirmScope: vi.fn((q: unknown) => q),
}));

import { dataProvider as supabase } from "@/lib/providers/data-provider";
import { resolveFirmIdForQuery, withFirmScope } from "@/lib/firm-scoped-query";
import { fetchPeoplePage, rowToPerson } from "@/lib/people-query";

describe("rowToPerson", () => {
  it("maps type from jsonb data when column type is null", () => {
    const person = rowToPerson({
      id: "C001",
      full_name: "Test Customer",
      phone: "9999999999",
      email: null,
      type: null,
      active: true,
      data: { type: "customer", fullName: "Test Customer" },
    });
    expect(person?.type).toBe("customer");
  });
});

describe("fetchPeoplePage firm scope", () => {
  beforeEach(() => {
    vi.mocked(resolveFirmIdForQuery).mockReset();
    vi.mocked(withFirmScope).mockReset();
    vi.mocked(withFirmScope).mockImplementation((q) => q);
  });

  it("returns empty when firm id cannot be resolved", async () => {
    vi.mocked(resolveFirmIdForQuery).mockResolvedValue(null);
    const result = await fetchPeoplePage({ types: ["customer"] });
    expect(result).toEqual({ people: [], page: 1, pageSize: 25, totalCount: 0 });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("applies withFirmScope before querying", async () => {
    vi.mocked(resolveFirmIdForQuery).mockResolvedValue("firm-abc");
    const result = { data: [], count: 0, error: null };
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.range = vi.fn(() => chain);
    chain.or = vi.fn(() => chain);
    chain.in = vi.fn(() => chain);
    chain.filter = vi.fn(() => chain);
    chain.then = (resolve: (v: typeof result) => void) => resolve(result);
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    await fetchPeoplePage({ types: ["karigar"] });

    expect(withFirmScope).toHaveBeenCalledWith(expect.anything(), "firm-abc");
    expect(chain.in).toHaveBeenCalledWith("type", ["karigar"]);
  });
});
