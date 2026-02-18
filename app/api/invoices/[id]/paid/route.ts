import { NextResponse } from "next/server";
import { mutateDb } from "@/lib/storage";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(_: Request, context: Context) {
  const { id } = await context.params;

  let found = false;
  const db = await mutateDb((current) => ({
    ...current,
    invoices: current.invoices.map((invoice) => {
      if (invoice.id !== id) {
        return invoice;
      }
      found = true;
      return {
        ...invoice,
        status: "paid",
        paidAt: new Date().toISOString()
      };
    })
  }));

  if (!found) {
    return NextResponse.json({ message: "Rechnung nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ invoices: db.invoices, orders: db.orders });
}
