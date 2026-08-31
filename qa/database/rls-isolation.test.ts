import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { QA_TENANTS } from "../fixtures/tenants";

const url = process.env.QA_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anon = process.env.QA_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

describe.skipIf(!url || !anon)("QA Supabase RLS isolation", () => {
  const client = createClient(url!, anon!);

  it("BLOCKED: karigar tenant A cannot read firm B parties without auth", async () => {
    const { data, error } = await client
      .from("people")
      .select("id")
      .eq("firm_id", QA_TENANTS.firmB.id)
      .limit(1);
    // Unauthenticated anon must not see tenant data
    expect(data ?? []).toHaveLength(0);
  });

  it("platform tables are not readable by anon", async () => {
    const { data } = await client.from("platform_firms").select("id").limit(1);
    expect(data ?? []).toHaveLength(0);
  });
});
