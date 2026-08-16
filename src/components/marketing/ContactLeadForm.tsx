import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitWebsiteLead } from "@/lib/website/website-service";
import { toast } from "sonner";

export function ContactLeadForm({
  intent = "contact",
  defaultInterest,
}: {
  intent?: string;
  defaultInterest?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const source =
      intent === "demo"
        ? "website_demo_request"
        : intent === "sales"
          ? "website_sales"
          : "website_contact";
    const res = await submitWebsiteLead({
      company_name: company,
      contact_name: name,
      contact_email: email,
      contact_phone: phone,
      city,
      interest: defaultInterest ?? intent,
      message,
      source,
      metadata: {
        utm: typeof window !== "undefined" ? window.location.search : "",
        referrer: typeof document !== "undefined" ? document.referrer : "",
      },
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not submit your request. Please try again.");
      return;
    }
    toast.success("Thank you — our team will contact you shortly.");
    setMessage("");
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company">Company / Firm</Label>
          <Input
            id="company"
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={busy} className="bg-gold text-slate-950 hover:bg-gold/90">
        {busy ? "Sending…" : intent === "demo" ? "Request Demo" : "Send Message"}
      </Button>
    </form>
  );
}
