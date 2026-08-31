/**
 * Stamp thead labels onto tbody cells so mobile CSS can stack tables as cards.
 * Presentation only — does not change data, columns, or calculations.
 */

export function startMobileTableLabelStamp(): () => void {
  if (typeof document === "undefined") return () => {};

  let scheduled = false;

  const stamp = () => {
    document.querySelectorAll("table").forEach((table) => {
      if (table.closest("[data-testid='print-layout-root']")) return;
      if (table.dataset.ornexaKeepTable === "true") return;
      const headers = [...table.querySelectorAll("thead th")].map((th) =>
        (th.textContent ?? "").replace(/\s+/g, " ").trim(),
      );
      if (headers.length < 2) return;
      table.classList.add("ornexa-stack-table");
      table.querySelectorAll("tbody tr").forEach((tr) => {
        const cells = [...tr.children];
        if (cells.length === 1 && cells[0].hasAttribute("colspan")) return;
        cells.forEach((td, i) => {
          if (!(td instanceof HTMLElement)) return;
          if (!headers[i]) return;
          if (td.getAttribute("data-label") !== headers[i]) {
            td.setAttribute("data-label", headers[i]);
          }
        });
      });
    });
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      stamp();
    });
  };

  stamp();
  const mo = new MutationObserver(schedule);
  mo.observe(document.body, { childList: true, subtree: true });
  return () => mo.disconnect();
}

/** Enable phone presentation on ERP, portal, and platform shells. */
export function startMobilePresentation(): () => void {
  if (typeof document === "undefined") return () => {};
  document.documentElement.setAttribute("data-layout", "mobile");
  return startMobileTableLabelStamp();
}
