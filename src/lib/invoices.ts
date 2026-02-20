import { Invoice } from "@/types/domain";

export const INVOICE_PAYMENT_WINDOW_DAYS = 14;

export type InvoiceRuntimeStage = "created" | "sent" | "overdue" | "paid";

function parseIsoTimestamp(value?: string): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? null : ts;
}

export function getInvoiceDueDate(invoice: Invoice): Date | null {
  if (invoice.status !== "sent") {
    return null;
  }

  const sentTs = parseIsoTimestamp(invoice.sentAt);
  if (sentTs === null) {
    return null;
  }

  return new Date(sentTs + INVOICE_PAYMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export function isInvoiceOverdue(invoice: Invoice, now = new Date()): boolean {
  if (invoice.status !== "sent") {
    return false;
  }

  const dueDate = getInvoiceDueDate(invoice);
  if (!dueDate) {
    return false;
  }

  return now.getTime() > dueDate.getTime();
}

export function getInvoiceRuntimeStage(invoice: Invoice, now = new Date()): InvoiceRuntimeStage {
  if (invoice.status === "paid") {
    return "paid";
  }

  if (invoice.status === "created") {
    return "created";
  }

  return isInvoiceOverdue(invoice, now) ? "overdue" : "sent";
}

export function getInvoiceStatusLabel(stage: InvoiceRuntimeStage): string {
  if (stage === "created") return "Erstellt";
  if (stage === "sent") return "Abgeschickt";
  if (stage === "overdue") return "Überfällig";
  return "Bezahlt";
}
