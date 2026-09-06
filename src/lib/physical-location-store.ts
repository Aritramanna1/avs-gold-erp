/**
 * Arivahly Venture Sphere (AVS) — Physical Inventory Locations & Movement Ledger
 * 
 * Hierarchy:
 * Showroom → Counter (1..N) → Tray (A..Z) → Safe (A/B/C) → Display Case (1..N) → Warehouse / Vault
 */

export interface LocationNode {
  id: string;
  name: string;
  type: 'Showroom' | 'Counter' | 'Tray' | 'Safe' | 'DisplayCase' | 'Warehouse' | 'WorkshopVendor';
  parentId?: string;
  fullPath: string; // e.g. "Showroom > Counter 1 > Tray A"
  capacityPieces?: number;
  currentPieceCount: number;
}

export interface InventoryMovementRecord {
  id: string;
  movementCode: string;
  pieceId: string;
  authenticationNumber: string;
  productName: string;
  fromLocationId: string;
  fromLocationPath: string;
  toLocationId: string;
  toLocationPath: string;
  timestamp: string;
  movedByStaff: string;
  reason: 'Display Restock' | 'Customer Viewing' | 'Safe Lockup' | 'Repair Dispatch' | 'Sold Delivery' | 'Audit Relocation';
  referenceTransactionId?: string;
}

export interface StockAuditReport {
  id: string;
  auditDate: string;
  auditedBy: string;
  locationId: string;
  locationPath: string;
  expectedPieces: number;
  physicallyCountedPieces: number;
  discrepancyCount: number;
  status: 'Clean' | 'Discrepancy_Detected' | 'Resolved';
  notes?: string;
}

const STORAGE_KEY_LOCATIONS = 'avs_physical_locations_v1';
const STORAGE_KEY_MOVEMENTS = 'avs_inventory_movements_v1';

export function getDefaultLocations(): LocationNode[] {
  return [
    { id: 'loc-showroom', name: 'Main Showroom', type: 'Showroom', fullPath: 'Main Showroom', currentPieceCount: 1290 },
    { id: 'loc-counter-1', name: 'Counter 1 (Diamond & Solitaires)', type: 'Counter', parentId: 'loc-showroom', fullPath: 'Main Showroom > Counter 1', currentPieceCount: 145 },
    { id: 'loc-counter-2', name: 'Counter 2 (Gold Jewellery)', type: 'Counter', parentId: 'loc-showroom', fullPath: 'Main Showroom > Counter 2', currentPieceCount: 380 },
    { id: 'loc-safe-a', name: 'Showroom Safe A (High Value)', type: 'Safe', parentId: 'loc-showroom', fullPath: 'Main Showroom > Safe A', currentPieceCount: 320 },
    { id: 'loc-safe-b', name: 'Showroom Safe B (Gold Stock)', type: 'Safe', parentId: 'loc-showroom', fullPath: 'Main Showroom > Safe B', currentPieceCount: 445 },
    { id: 'loc-warehouse', name: 'Central Vault / Warehouse', type: 'Warehouse', fullPath: 'Central Vault', currentPieceCount: 650 },
  ];
}

export function getPhysicalLocations(): LocationNode[] {
  if (typeof window === 'undefined') return getDefaultLocations();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCATIONS);
    return raw ? JSON.parse(raw) : getDefaultLocations();
  } catch {
    return getDefaultLocations();
  }
}

export function getInventoryMovements(): InventoryMovementRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MOVEMENTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function logInventoryMovement(movement: Omit<InventoryMovementRecord, 'id' | 'movementCode' | 'timestamp'>): InventoryMovementRecord {
  const full: InventoryMovementRecord = {
    ...movement,
    id: `MOV-${Date.now()}`,
    movementCode: `AVS-MOV-${Date.now().toString().slice(-6)}`,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      const logs = getInventoryMovements();
      logs.unshift(full);
      localStorage.setItem(STORAGE_KEY_MOVEMENTS, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to log inventory movement', e);
    }
  }

  return full;
}
