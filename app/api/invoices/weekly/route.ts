import { NextResponse } from "next/server";
import { createWeeklyInvoices, readDb } from "@/lib/storage";

type WeeklyInvoiceRequestBody = {
  customerIds?: string[];
  weekStart?: string;
  weekEnd?: string;
};

function getCurrentIsoWeekBoundaries(): { weekStartIso: string; weekEndIso: string } {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const isoDay = utcDay === 0 ? 7 : utcDay;

  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  weekStart.setUTCDate(weekStart.getUTCDate() - (isoDay - 1));
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return {
    weekStartIso: weekStart.toISOString(),
    weekEndIso: weekEnd.toISOString()
  };
}

function resolveWeekRange(weekStart?: string, weekEnd?: string): { weekStartIso: string; weekEndIso: string } {
  const startDate = typeof weekStart === "string" ? new Date(weekStart) : null;
  const endDate = typeof weekEnd === "string" ? new Date(weekEnd) : null;

  const hasValidStart = !!startDate && !Number.isNaN(startDate.getTime());
  const hasValidEnd = !!endDate && !Number.isNaN(endDate.getTime());

  if (!hasValidStart || !hasValidEnd || (startDate as Date).getTime() > (endDate as Date).getTime()) {
    return getCurrentIsoWeekBoundaries();
  }

  return {
    weekStartIso: (startDate as Date).toISOString(),
    weekEndIso: (endDate as Date).toISOString()
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as WeeklyInvoiceRequestBody;

  const customerIds =
    Array.isArray(body.customerIds) && body.customerIds.length > 0
      ? body.customerIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];

  const { weekStartIso, weekEndIso } = resolveWeekRange(body.weekStart, body.weekEnd);

  const effectiveCustomerIds =
    customerIds.length > 0 ? customerIds : (await readDb()).customers.map((customer) => customer.id);

  const result = await createWeeklyInvoices(effectiveCustomerIds, weekStartIso, weekEndIso);

  return NextResponse.json({
    message: `${result.invoices.length} Rechnung(en) erstellt`,
    invoices: result.invoices,
    skippedCustomers: result.skippedCustomers
  });
}
