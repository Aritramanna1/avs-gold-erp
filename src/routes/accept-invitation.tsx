import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/accept-invitation")({
  head: () => ({ meta: [{ title: "Accept Invitation · AVS ERP" }] }),
  beforeLoad: ({ location }) => {
    // Universal acceptance URL entry point forwarding all query params to /invite/accept
    const searchParams = new URLSearchParams(location.search);
    const code = searchParams.get("code") || searchParams.get("token") || "";
    const email = searchParams.get("email") || "";
    const phone = searchParams.get("phone") || "";
    
    const targetParams = new URLSearchParams();
    if (code) targetParams.set("code", code);
    if (email) targetParams.set("email", email);
    if (phone) targetParams.set("phone", phone);
    
    const queryString = targetParams.toString();
    const destination = `/invite/accept${queryString ? `?${queryString}` : ""}`;
    throw redirect({ to: destination as "/invite/accept", replace: true });
  },
  component: () => null,
});
