/**
 * Native ERP Automation Engine — Quotation, Appointment & CRM Lifecycle
 */

import { createERPEvent } from "./events";
import { automationRuleEngine } from "./rule-engine";

export interface QuotationAutomationPayload {
  quotationId: string;
  quotationNumber: string;
  customerId: string;
  customerName: string;
  items: Array<{ description: string; grossWeightG: number; purity: string; estimatedPricePaise: number }>;
  totalPaise: number;
}

export interface AppointmentAutomationPayload {
  appointmentId: string;
  customerId: string;
  customerName: string;
  scheduledTime: string;
  serviceType: string;
  status: "scheduled" | "confirmed" | "completed" | "missed";
}

export class CRMQuotationAutomationService {
  async convertQuotationToSale(
    payload: QuotationAutomationPayload,
    tenantId = "default_tenant",
    actorId = "system",
  ) {
    // 1. Emit QUOTATION_CONVERTED_TO_SALE
    const convertedEvent = createERPEvent(
      "QUOTATION_CONVERTED_TO_SALE",
      {
        quotationId: payload.quotationId,
        quotationNumber: payload.quotationNumber,
        customerId: payload.customerId,
        customerName: payload.customerName,
        totalAmountPaise: payload.totalPaise,
        itemsCount: payload.items.length,
      },
      { tenantId, actorId, idempotencyKey: `quote_conv_${payload.quotationId}` },
    );

    await automationRuleEngine.processEvent(convertedEvent);

    // 2. Emit SALE_CONFIRMED to auto-trigger stock & ledger without duplicate entries
    const saleEvent = createERPEvent(
      "SALE_CONFIRMED",
      {
        status: "confirmed",
        invoiceNumber: `INV-FROM-${payload.quotationNumber}`,
        customerId: payload.customerId,
        customerName: payload.customerName,
        totalAmountPaise: payload.totalPaise,
        sourceQuotationId: payload.quotationId,
      },
      { tenantId, actorId, idempotencyKey: `sale_conv_${payload.quotationId}` },
    );

    return await automationRuleEngine.processEvent(saleEvent);
  }

  async trackAppointment(
    payload: AppointmentAutomationPayload,
    tenantId = "default_tenant",
    actorId = "system",
  ) {
    const eventType =
      payload.status === "completed"
        ? "APPOINTMENT_COMPLETED"
        : payload.status === "missed"
        ? "APPOINTMENT_MISSED"
        : "APPOINTMENT_CREATED";

    const event = createERPEvent(
      eventType,
      {
        appointmentId: payload.appointmentId,
        customerId: payload.customerId,
        customerName: payload.customerName,
        scheduledTime: payload.scheduledTime,
        serviceType: payload.serviceType,
      },
      { tenantId, actorId, idempotencyKey: `appt_${payload.appointmentId}_${payload.status}` },
    );

    return await automationRuleEngine.processEvent(event);
  }
}

export const crmQuotationAutomation = new CRMQuotationAutomationService();
