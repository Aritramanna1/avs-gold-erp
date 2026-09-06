// Public trial signup disabled — invitation / request access only
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  return new Response(
    JSON.stringify({
      error: "PUBLIC_SIGNUP_DISABLED",
      message: "Direct self-signup is disabled. Please request access or contact your administrator.",
    }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    },
  );
});
