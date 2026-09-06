/**
 * Training progress — persisted to user_tutorial_progress (Supabase).
 */
import { create } from "zustand";
import { dataProvider as supabase } from "@/lib/providers/data-provider";

export interface TutorialProgress {
  moduleCode: string;
  progressPercentage: number;
  currentStepIndex: number;
  isCompleted: boolean;
  completedAt?: string;
  roleContext?: string;
}

interface TrainingProgressState {
  modules: TutorialProgress[];
  loading: boolean;
  hydrate: () => Promise<void>;
  upsertProgress: (input: Partial<TutorialProgress> & { moduleCode: string }) => Promise<void>;
  markComplete: (moduleCode: string) => Promise<void>;
}

function mapRow(row: Record<string, unknown>): TutorialProgress {
  return {
    moduleCode: String(row.module_code),
    progressPercentage: Number(row.progress_percentage ?? 0),
    currentStepIndex: Number(row.current_step_index ?? 0),
    isCompleted: Boolean(row.is_completed),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    roleContext: row.role_context ? String(row.role_context) : undefined,
  };
}

export const useTrainingProgressStore = create<TrainingProgressState>()((set, get) => ({
  modules: [],
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    const { data: sessionResult } = await supabase.auth.getSession();
    const userId = sessionResult.session?.user?.id;
    if (!userId) {
      set({ loading: false });
      return;
    }
    const { data, error } = await supabase
      .from("user_tutorial_progress" as never)
      .select("*")
      .eq("user_id", userId);
    if (!error && data) {
      set({ modules: (data as Record<string, unknown>[]).map(mapRow) });
    }
    set({ loading: false });
  },

  upsertProgress: async (input) => {
    const { data: sessionResult } = await supabase.auth.getSession();
    const userId = sessionResult.session?.user?.id;
    if (!userId) return;
    const { data: profile } = await supabase
      .from("user_profiles" as never)
      .select("firm_id")
      .eq("auth_id", userId)
      .maybeSingle();
    const firmId = (profile as { firm_id?: string } | null)?.firm_id;
    if (!firmId) return;

    await supabase.from("user_tutorial_progress" as never).upsert(
      {
        user_id: userId,
        firm_id: firmId,
        module_code: input.moduleCode,
        progress_percentage: input.progressPercentage ?? 0,
        current_step_index: input.currentStepIndex ?? 0,
        is_completed: input.isCompleted ?? false,
        completed_at: input.isCompleted ? new Date().toISOString() : null,
        role_context: input.roleContext ?? null,
        last_updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,module_code" },
    );
    await get().hydrate();
  },

  markComplete: async (moduleCode) => {
    await get().upsertProgress({
      moduleCode,
      progressPercentage: 100,
      isCompleted: true,
    });
  },
}));

export function getModuleProgress(
  modules: TutorialProgress[],
  moduleCode: string,
): TutorialProgress | undefined {
  return modules.find((m) => m.moduleCode === moduleCode);
}
