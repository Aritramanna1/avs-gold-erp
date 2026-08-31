import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { KEYBOARD_EVENTS } from "@/lib/keyboard/keyboard-events";
import { getShortcutDisplayLabel } from "@/lib/keyboard/shortcut-keys";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { navigationItems } from "@/components/layout/Sidebar";
import { searchAll, searchRemote, type SearchResult } from "@/lib/global-search";
import { useSettings } from "@/lib/settings-store";
import { hasRoutePermission } from "@/lib/permissions";
import {
  User,
  ShoppingBag,
  Receipt,
  Package,
  Hammer,
  Building2,
  FileText,
  Tag,
} from "lucide-react";

const RESULT_ICONS: Record<SearchResult["type"], typeof User> = {
  person: User,
  order: ShoppingBag,
  invoice: Receipt,
  stock_item: Package,
  job: Hammer,
  party: User,
  document: FileText,
  branch: Building2,
  tag: Tag,
};

/**
 * Keyboard-first global navigation (Priority 4).
 *
 * Ctrl+F / Ctrl+K opens it from anywhere in the app (not just when a search
 * box happens to be focused) — "Search should focus immediately" per the
 * requirement. Esc closes it for free (CommandDialog is our own Radix
 * Dialog underneath — every Radix dialog in this app already closes on Esc
 * without any code added here). Enter navigates to the highlighted item.
 *
 * Deliberately does NOT intercept Ctrl+F when the user is already inside a
 * text input/textarea/contenteditable — a form's own in-page search or
 * text-selection behavior must never be hijacked by a global shortcut.
 */
export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const role = useSettings((s) => s.currentUserRole);
  const navigate = useNavigate();
  const localResults = searchAll(query, 5, role);
  const recordResults = [...localResults, ...remoteResults].filter((result, index, all) => {
    const key = `${result.type}:${result.id}:${result.route}`;
    return all.findIndex((item) => `${item.type}:${item.id}:${item.route}` === key) === index;
  });
  const moduleResults = navigationItems.filter(
    (item) => typeof item.to === "string" && hasRoutePermission(role, item.to),
  );

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(KEYBOARD_EVENTS.COMMAND_PALETTE, onOpen);
    return () => window.removeEventListener(KEYBOARD_EVENTS.COMMAND_PALETTE, onOpen);
  }, []);

  const paletteKeys = getShortcutDisplayLabel("nav_command_palette", "Ctrl+K");
  const findKeys = getShortcutDisplayLabel("nav_find", "Ctrl+F");

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 2) {
      setRemoteResults([]);
      setRemoteLoading(false);
      return;
    }

    let cancelled = false;
    setRemoteLoading(true);
    const timer = window.setTimeout(() => {
      void searchRemote(trimmed, 6, role)
        .then((results) => {
          if (!cancelled) setRemoteResults(results);
        })
        .finally(() => {
          if (!cancelled) setRemoteLoading(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query, role]);

  return (
    <CommandDialog
      shouldFilter={false}
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <CommandInput
        placeholder={`Search modules or records... (${findKeys} / ${paletteKeys})`}
        autoFocus
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{remoteLoading ? "Searching records..." : "No matches."}</CommandEmpty>
        {recordResults.length > 0 && (
          <CommandGroup heading="Records">
            {recordResults.map((r) => {
              const Icon = RESULT_ICONS[r.type];
              return (
                <CommandItem
                  key={`${r.type}-${r.id}`}
                  value={`${r.type}-${r.id}-${r.title}`}
                  onSelect={() => {
                    setOpen(false);
                    setQuery("");
                    navigate({ to: r.route as any });
                  }}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{r.title}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{r.subtitle}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
        <CommandGroup heading="Modules">
          {moduleResults.map((item) => (
            <CommandItem
              key={item.to}
              value={item.label}
              onSelect={() => {
                setOpen(false);
                setQuery("");
                navigate({ to: item.to });
              }}
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
