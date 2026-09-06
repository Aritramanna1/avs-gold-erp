/**
 * AVS ERP — Manufacturing Production Engine, Auto-Barcode & Delivery Workflow
 *
 * Core Features:
 * - Production Workflow Mode: Simple Production (default) | Job Card | Order-Based
 * - Production Receive → Automatically updates Ready Stock + Generates Unique Barcode
 * - Bulk Barcode Printing
 * - Hardware Integration Layer (Scanner, Label printer, Thermal printer, Keyboard wedge)
 * - Manufacturing Invoice Delivery Integration (Delivery = ON automatically creates delivery workflow)
 * - End-to-end Lineage: Raw Material → Production → Finished Product → Ready Stock → Barcode → Retail Sale
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useStock } from "@/lib/stock-store";
import { gramsToMg, mgToGrams, fineGoldMg, parsePurity } from "@/lib/gold";
import { toast } from "sonner";

export type ProductionWorkflowMode = "simple_production" | "job_card" | "order_based";

export interface ManufacturedProductRecord {
  id: string;
  productionCode: string; // e.g. PROD-2026-0081
  barcode: string; // e.g. AVS-BAR-990124
  sku: string;
  name: string;
  category: string;
  purity: number; // 916
  grossWeightGrams: number;
  netGoldWeightGrams: number;
  stoneWeightCarats?: number;
  stoneValuePaise?: number;
  makingChargesPaise?: number;
  huidNumber?: string;
  hallmarkRequired: boolean;
  huidChargePaise?: number;
  otherChargesPaise?: number;
  otherChargeType?: string; // e.g. 'Lab Certification', 'Laser Engraving'
  productionMode: ProductionWorkflowMode;
  karigarId?: string;
  karigarName?: string;
  jobCardId?: string;
  orderId?: string;
  readyStockId?: string;
  status: "IN_PRODUCTION" | "RECEIVED_READY_STOCK" | "DELIVERED_TO_RETAIL" | "SOLD";
  createdAt: string;
  receivedAt?: string;
}

export interface ManufacturingDeliveryRecord {
  id: string;
  deliveryCode: string; // e.g. AVS-DEL-2026-0041
  invoiceId: string;
  invoiceNo: string;
  partyName: string;
  partyPhone?: string;
  itemsCount: number;
  totalWeightGrams: number;
  status: "Prepared" | "Out for Delivery" | "Delivered";
  assignedDeliveryPerson?: string;
  deliveryAddress?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  customerSignatureObtained: boolean;
  createdAt: string;
}

interface ManufacturingProductionState {
  workflowMode: ProductionWorkflowMode;
  products: ManufacturedProductRecord[];
  deliveries: ManufacturingDeliveryRecord[];
  setWorkflowMode: (mode: ProductionWorkflowMode) => void;
  receiveProductionItem: (
    item: Omit<ManufacturedProductRecord, "id" | "productionCode" | "barcode" | "status" | "createdAt" | "receivedAt" | "readyStockId">,
  ) => Promise<ManufacturedProductRecord>;
  createDeliveryFromInvoice: (payload: {
    invoiceId: string;
    invoiceNo: string;
    partyName: string;
    partyPhone?: string;
    itemsCount: number;
    totalWeightGrams: number;
    deliveryAddress?: string;
  }) => ManufacturingDeliveryRecord;
  updateDeliveryStatus: (deliveryId: string, status: ManufacturingDeliveryRecord["status"]) => void;
}

export const useManufacturingProduction = create<ManufacturingProductionState>()(
  persist(
    (set, get) => ({
      workflowMode: "simple_production",
      products: [
        {
          id: "prod-sample-1",
          productionCode: "PROD-2026-0001",
          barcode: "AVS-BAR-2026-000101",
          sku: "AVS-NK-22K-084",
          name: "22K Royal Temple Antique Necklace",
          category: "Necklaces",
          purity: 916,
          grossWeightGrams: 48.65,
          netGoldWeightGrams: 45.10,
          stoneWeightCarats: 17.75,
          stoneValuePaise: 3500000,
          hallmarkRequired: true,
          huidNumber: "AB94X2",
          huidChargePaise: 4500, // ₹45 BIS HUID fee
          productionMode: "simple_production",
          karigarId: "karigar_1",
          karigarName: "Master Karigar Bimal",
          status: "RECEIVED_READY_STOCK",
          createdAt: "2026-09-02T10:00:00Z",
          receivedAt: "2026-09-05T14:00:00Z",
        },
      ],
      deliveries: [],

      setWorkflowMode: (mode) => set({ workflowMode: mode }),

      receiveProductionItem: async (itemPayload) => {
        const id = `PROD-${Date.now()}`;
        const productionCode = `PROD-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
        const barcode = `AVS-BAR-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const timestamp = new Date().toISOString();

        // Automatically create Ready Stock entry in inventory
        const addReadyStock = useStock.getState().addReadyStock;
        const grossMg = gramsToMg(itemPayload.grossWeightGrams.toString());
        const netMg = gramsToMg(itemPayload.netGoldWeightGrams.toString());

        const stockRes = await addReadyStock(
          {
            itemName: itemPayload.name,
            category: itemPayload.category || "Manufactured",
            purity: itemPayload.purity,
            grossMg,
            netMg,
            location: "safe",
            status: "available",
            notes: `Manufactured via ${productionCode} · Barcode: ${barcode}${itemPayload.huidNumber ? ` · HUID: ${itemPayload.huidNumber}` : ""}`,
          },
          "manufactured",
        );

        const newProduct: ManufacturedProductRecord = {
          ...itemPayload,
          id,
          productionCode,
          barcode,
          readyStockId: stockRes?.id,
          status: "RECEIVED_READY_STOCK",
          createdAt: timestamp,
          receivedAt: timestamp,
        };

        set((state) => ({
          products: [newProduct, ...state.products],
        }));

        toast.success(`Production received! Added to Ready Stock with barcode: ${barcode}`);
        return newProduct;
      },

      createDeliveryFromInvoice: (payload) => {
        const id = `DEL-${Date.now()}`;
        const deliveryCode = `AVS-DEL-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
        const timestamp = new Date().toISOString();

        const newDelivery: ManufacturingDeliveryRecord = {
          id,
          deliveryCode,
          ...payload,
          status: "Prepared",
          customerSignatureObtained: false,
          createdAt: timestamp,
        };

        set((state) => ({
          deliveries: [newDelivery, ...state.deliveries],
        }));

        toast.success(`Delivery record ${deliveryCode} created for Invoice ${payload.invoiceNo}`);
        return newDelivery;
      },

      updateDeliveryStatus: (deliveryId, status) => {
        set((state) => ({
          deliveries: state.deliveries.map((d) =>
            d.id === deliveryId
              ? {
                  ...d,
                  status,
                  dispatchedAt: status === "Out for Delivery" ? new Date().toISOString() : d.dispatchedAt,
                  deliveredAt: status === "Delivered" ? new Date().toISOString() : d.deliveredAt,
                }
              : d,
          ),
        }));
        toast.success(`Delivery status updated to ${status}`);
      },
    }),
    {
      name: "avs_manufacturing_production_engine_v1",
    },
  ),
);
