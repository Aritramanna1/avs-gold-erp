/**
 * Customer-facing message text for orders — rendered from the WhatsApp
 * TEMPLATES the workshop edits in Settings (Settings → WhatsApp Templates), not
 * from strings baked into the code.
 *
 * These previously hard-coded the wording. That meant the shop could not change
 * how it speaks to its customers without a developer — and the same message
 * existed in three slightly different versions across the create-order screen,
 * the order screen and the reminder dialog.
 *
 * Now there is one path: template (from Settings) → placeholders (wa-placeholders'
 * buildContext, which knows the order, its items, the customer and the firm) →
 * text. Editing the template in Settings changes every screen at once.
 *
 * Transport is a separate concern: see comm/send-whatsapp-text.ts, which routes
 * the rendered text through the branch's configured provider (deep link today,
 * OpenWA later). Business logic here produces WORDS; it never opens a link.
 */
import type { Order } from "./orders-store";
import { orderItems } from "./orders-store";
import { useWaTemplates, DEFAULT_BODIES, type TemplateKind } from "./wa-templates-store";
import { buildContext, renderTemplate } from "./wa-placeholders";

/**
 * Renders a template for an order.
 *
 * Falls back to the built-in default body when the workshop has no active
 * template of that kind — a customer must still get a sensible message if
 * someone deactivates or deletes a template, rather than an empty one.
 */
export function renderOrderTemplate(kind: TemplateKind, order: Pick<Order, "id">): string {
  const template = useWaTemplates.getState().templates.find((t) => t.kind === kind && t.active);

  const body = template?.body || DEFAULT_BODIES[kind];
  const ctx = buildContext({ orderId: order.id });
  return renderTemplate(body, ctx);
}

/** Every piece on the order, named — not just the first. */
export function itemSummary(order: Pick<Order, "items" | "item">): string {
  const items = orderItems(order);
  if (items.length === 0) return "your order";
  return items
    .map((it) => (it.quantity > 1 ? `${it.quantity} × ${it.itemName}` : it.itemName))
    .join(", ");
}

/**
 * Sent right after an order is created: thanks, confirms, states the date.
 * Wording lives in Settings → WhatsApp Templates → "Customer Order Confirmation".
 */
export function orderConfirmationMessage(order: Pick<Order, "id">): string {
  return renderOrderTemplate("order_confirm", order);
}

/**
 * The "Remind" action — a nudge about an order already in progress.
 * Wording lives in Settings → WhatsApp Templates → "Customer Delay Update".
 */
export function orderReminderMessage(order: Pick<Order, "id">): string {
  return renderOrderTemplate("delay_update", order);
}
