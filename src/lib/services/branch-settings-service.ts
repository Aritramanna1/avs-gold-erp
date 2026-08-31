import type { BranchSettings } from "@/lib/settings-store";
import { saveDirect } from "@/lib/supabase-write";

export async function saveBranchSettings(value: BranchSettings): Promise<void> {
  await saveDirect("branch_settings", value.branchId, value);
}
