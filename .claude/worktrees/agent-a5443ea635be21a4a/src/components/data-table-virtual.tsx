/**
 * MTJ ERP — Virtualized Data Table
 * Uses @tanstack/react-virtual for rendering only visible rows.
 * Drop-in replacement for regular HTML tables in large list views.
 */
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface VirtualColumn<T> {
  key: string;
  header: string;
  cell: (row: T, index: number) => React.ReactNode;
  width?: string; // CSS width e.g. '120px' or '1fr'
}

interface DataTableVirtualProps<T> {
  data: T[];
  columns: VirtualColumn<T>[];
  rowHeight?: number;
  maxHeight?: string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  getRowKey: (row: T, index: number) => string;
}

export function DataTableVirtual<T>({
  data,
  columns,
  rowHeight = 48,
  maxHeight = "600px",
  onRowClick,
  emptyMessage = "No data found.",
  getRowKey,
}: DataTableVirtualProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const items = virtualizer.getVirtualItems();

  if (data.length === 0) {
    return <div className="text-center text-muted-foreground py-12 text-sm">{emptyMessage}</div>;
  }

  const gridTemplate = columns.map((c) => c.width ?? "1fr").join(" ");

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div
        className="grid bg-muted/30 border-b border-border"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className="px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            {col.header}
          </div>
        ))}
      </div>
      {/* Virtual scroll body */}
      <div ref={parentRef} style={{ maxHeight, overflowY: "auto" }}>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {items.map((virtualRow) => {
            const row = data[virtualRow.index];
            return (
              <div
                key={getRowKey(row, virtualRow.index)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                  gridTemplateColumns: gridTemplate,
                }}
                className={`grid border-b border-border/50 hover:bg-muted/20 transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <div key={col.key} className="px-3 flex items-center text-sm overflow-hidden">
                    {col.cell(row, virtualRow.index)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
