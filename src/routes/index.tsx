import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        throw redirect({ to: "/app" });
      }
    } catch (e) {
      if (e && typeof e === "object" && "isRedirect" in e) throw e;
    }
    throw redirect({ to: "/login", search: { redirect: undefined, error: undefined, audience: undefined } });
  },
  component: () => null,
});

