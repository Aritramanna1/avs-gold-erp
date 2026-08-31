/**
 * Searchable party picker — all People types (customer, supplier, karigar, employee, etc.).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePeople, type Person } from "@/lib/people-store";
import { cn } from "@/lib/utils";

export interface PartySearchSelectProps {
  value: string;
  onChange: (partyId: string, person: Person | null) => void;
  required?: boolean;
  label?: string;
  id?: string;
  className?: string;
}

export function PartySearchSelect({
  value,
  onChange,
  required,
  label = "Party",
  id = "party-search",
  className,
}: PartySearchSelectProps) {
  const people = usePeople((s) => s.people);
  const refresh = usePeople((s) => s.refresh);
  const selected = people.find((p) => p.id === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (people.length === 0) void refresh?.();
  }, [people.length, refresh]);

  useEffect(() => {
    if (selected) setQuery(selected.fullName);
  }, [selected?.id, selected?.fullName]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people.slice(0, 40);
    return people
      .filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          (p.phone && p.phone.includes(q)) ||
          (p.type && p.type.toLowerCase().includes(q)) ||
          (p.partyCode && p.partyCode.toLowerCase().includes(q)),
      )
      .slice(0, 40);
  }, [people, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(p: Person) {
    onChange(p.id, p);
    setQuery(p.fullName);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={cn("relative space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Input
        id={id}
        value={query}
        autoComplete="off"
        placeholder="Search all people…"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange("", null);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
            setOpen(true);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && filtered[activeIdx]) {
            e.preventDefault();
            pick(filtered[activeIdx]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        aria-required={required}
        aria-expanded={open}
        aria-controls={`${id}-list`}
      />
      {selected && (
        <p className="text-xs text-muted-foreground capitalize">
          {selected.type?.replace(/_/g, " ") || "party"}
          {selected.phone ? ` · ${selected.phone}` : ""}
        </p>
      )}
      {open && filtered.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover shadow-md"
        >
          {filtered.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-muted",
                  i === activeIdx && "bg-muted",
                )}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => pick(p)}
              >
                <span className="font-medium">{p.fullName}</span>
                <span className="text-xs text-muted-foreground ml-2 capitalize">
                  {p.type?.replace(/_/g, " ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
          No people match. Add them under People first.
        </div>
      )}
    </div>
  );
}
