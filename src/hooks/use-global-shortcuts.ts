/**
 * Global Keyboard Shortcut Dispatcher
 * Master Reference: docs/KEYBOARD_AND_INPUT_MASTER.md
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useShortcutsStore } from "@/lib/shortcuts-store";
import {
  comboFromKeyboardEvent,
  isProtectedBrowserCombo,
  normalizeKeyCombo,
} from "@/lib/keyboard/normalize-combo";
import { dispatchKeyboardAction, KEYBOARD_EVENTS } from "@/lib/keyboard/keyboard-events";
import { useDeviceClass } from "@/hooks/use-device-class";

export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const shortcuts = useShortcutsStore((s) => s.shortcuts);
  const device = useDeviceClass();

  useEffect(() => {
    // Keyboard power-user mode is desktop/tablet-landscape only
    if (device === "mobile") return;

    function handleKeyDown(e: KeyboardEvent) {
      if (isProtectedBrowserCombo(e)) return;

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.tagName === "SELECT");

      const pressedCombo = comboFromKeyboardEvent(e);
      if (!pressedCombo) return;

      for (const s of shortcuts) {
        const targetCombo = normalizeKeyCombo(s.customKeys || s.defaultKeys);
        if (targetCombo !== pressedCombo) continue;

        // In inputs: allow modifier combos only
        if (isInput && !e.altKey && !e.ctrlKey && !e.metaKey) continue;

        const action = s.action ?? (s.routeTarget ? "navigate" : undefined);
        if (!action) continue;

        e.preventDefault();

        switch (action) {
          case "navigate":
            if (s.routeTarget) void navigate({ to: s.routeTarget as "/" });
            return;
          case "command_palette":
            dispatchKeyboardAction(KEYBOARD_EVENTS.COMMAND_PALETTE);
            return;
          case "cheat_sheet":
            dispatchKeyboardAction(KEYBOARD_EVENTS.CHEAT_SHEET);
            return;
          case "assistant":
            dispatchKeyboardAction(KEYBOARD_EVENTS.ASSISTANT_OPEN);
            return;
          case "history_back":
            window.history.back();
            return;
          default:
            return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, navigate, device]);
}
