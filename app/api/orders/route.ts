import { NextRequest, NextResponse } from "next/server";
import { createOrderId, mutateDb, readDb } from "@/lib/storage";
import { Order } from "@/types/domain";

type OrderInput = {
  licensePlate?: string;
  vehicleModel?: string;
  baseServiceId?: string;
  addonServiceIds?: string[];
  notes?: string;
};

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

function toOrderLine(input: OrderInput, customerId: string, completedAt: string): Order {
  return {
    id: createOrderId(),
    customerId,
    licensePlate: String(input.licensePlate || "").toUpperCase(),
    vehicleModel: String(input.vehicleModel || ""),
    baseServiceId: String(input.baseServiceId || ""),
    addonServiceIds: Array.isArray(input.addonServiceIds) ? input.addonServiceIds.map(String) : [],
    notes: input.notes ? String(input.notes) : "",
    status: "completed",
    createdAt: new Date().toISOString(),
    completedAt
  };
}

export async function GET() {
  const db = await readDb();
  const orders = [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const ordersWithCustomer = orders.map((order) => {
    const customer = db.customers.find((c) => c.id === order.customerId);
    return {
      ...order,
      customerName: customer?.name || "Unbekannt"
    };
  });

  return NextResponse.json({ orders: ordersWithCustomer, invoices: db.invoices, customers: db.customers });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (!body.customerId) {
    return NextResponse.json({ message: "Kunde fehlt." }, { status: 400 });
  }

  const customerId = String(body.customerId);
  const completedAt = parseCompletedAt(body.completedAt) ?? new Date().toISOString();

  const incomingLines: OrderInput[] = Array.isArray(body.orders)
    ? body.orders
    : [
        {
          licensePlate: body.licensePlate,
          vehicleModel: body.vehicleModel,
          baseServiceId: body.baseServiceId,
          addonServiceIds: body.addonServiceIds,
          notes: body.notes
        }
      ];

  if (incomingLines.length === 0) {
    return NextResponse.json({ message: "Keine Posten übergeben." }, { status: 400 });
  }

  const invalidIndex = incomingLines.findIndex(
    (line) => !line.licensePlate || !line.vehicleModel || !line.baseServiceId
  );

  if (invalidIndex !== -1) {
    return NextResponse.json(
      { message: `Pflichtfelder fehlen in Posten ${invalidIndex + 1}.` },
      { status: 400 }
    );
  }

  const newOrders = incomingLines.map((line) => toOrderLine(line, customerId, completedAt));

  const db = await mutateDb((current) => ({ ...current, orders: [...newOrders, ...current.orders] }));

  const customer = db.customers.find((c) => c.id === customerId);
  const ordersWithCustomer = newOrders.map((order) => ({
    ...order,
    customerName: customer?.name || "Unbekannt"
  }));

  return NextResponse.json(
    {
      order: ordersWithCustomer[0],
      ordersCreated: ordersWithCustomer.length,
      orders: db.orders,
      createdOrders: ordersWithCustomer,
      invoices: db.invoices,
      customers: db.customers
    },
    { status: 201 }
  );
}
