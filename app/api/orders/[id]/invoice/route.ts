import { NextResponse } from "next/server";
import { buildInvoiceFromOrder, mutateDb, readDb } from "@/lib/storage";

type Context = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: Context) {
  const { id } = await context.params;
  const current = await readDb();
  const order = current.orders.find((item) => item.id === id);

  if (!order) {
    return NextResponse.json({ message: "Auftrag nicht gefunden." }, { status: 404 });
  }

  if (order.invoiceId) {
    const invoice = current.invoices.find((item) => item.id === order.invoiceId);
    return NextResponse.json({ invoice, orders: current.orders, invoices: current.invoices });
  }

  const customer = current.customers.find((item) => item.id === order.customerId);
  const customerName = customer?.name || "Unbekannt";
  const invoice = buildInvoiceFromOrder(order, customerName, current.invoices.length);

  const db = await mutateDb((dbState) => ({
    ...dbState,
    invoices: [invoice, ...dbState.invoices],
    orders: dbState.orders.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "completed",
            completedAt: item.completedAt ?? new Date().toISOString(),
            invoiceId: invoice.id
          }
        : item
    )
  }));

  return NextResponse.json({ invoice, orders: db.orders, invoices: db.invoices }, { status: 201 });
}
