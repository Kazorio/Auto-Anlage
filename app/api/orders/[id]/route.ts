import { NextRequest, NextResponse } from "next/server";
import { mutateDb, readDb } from "@/lib/storage";
import { ProgramNumber } from "@/types/domain";

type Context = { params: Promise<{ id: string }> };

function parseCompletedAt(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function toProgramNumber(value: unknown): ProgramNumber | null {
  const asNumber = Number(value);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 6) {
    return asNumber as ProgramNumber;
  }
  return null;
}

export async function PUT(request: NextRequest, context: Context) {
  const { id } = await context.params;
  const body = await request.json();

  const existing = await readDb();
  const currentOrder = existing.orders.find((order) => order.id === id);
  if (!currentOrder) {
    return NextResponse.json({ message: "Auftrag nicht gefunden." }, { status: 404 });
  }

  const requestedProgramNumber = body.programNumber !== undefined ? toProgramNumber(body.programNumber) : null;
  if (body.programNumber !== undefined && !requestedProgramNumber) {
    return NextResponse.json({ message: "Programm muss zwischen 1 und 6 liegen." }, { status: 400 });
  }

  const db = await mutateDb((current) => ({
    ...current,
    orders: current.orders.map((order) => {
      if (order.id !== id) {
        return order;
      }

      const requestedCompletedAt = parseCompletedAt(body.completedAt);

      return {
        ...order,
        customerId: body.customerId ? String(body.customerId) : order.customerId,
        vin: body.vin ? String(body.vin).toUpperCase() : order.vin,
        licensePlate: body.licensePlate ? String(body.licensePlate).toUpperCase() : order.licensePlate,
        programNumber: requestedProgramNumber ?? order.programNumber,
        vehicleModel: body.vehicleModel ? String(body.vehicleModel) : order.vehicleModel,
        baseServiceId: body.baseServiceId ? String(body.baseServiceId) : order.baseServiceId,
        addonServiceIds: Array.isArray(body.addonServiceIds) ? body.addonServiceIds.map(String) : order.addonServiceIds,
        notes: typeof body.notes === "string" ? body.notes : order.notes,
        status: "completed",
        completedAt: requestedCompletedAt ?? order.completedAt ?? new Date().toISOString()
      };
    })
  }));

  const updated = db.orders.find((order) => order.id === id);

  const customer = db.customers.find((c) => c.id === updated?.customerId);
  const orderWithCustomer = updated
    ? {
        ...updated,
        customerName: customer?.name || "Unbekannt"
      }
    : null;

  return NextResponse.json({ order: orderWithCustomer, orders: db.orders, invoices: db.invoices, customers: db.customers });
}
