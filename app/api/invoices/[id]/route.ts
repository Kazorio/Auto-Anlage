import { NextResponse } from "next/server";
import { readDb } from "@/lib/storage";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const { id } = await context.params;
  const db = await readDb();
  const invoice = db.invoices.find((item) => item.id === id);

  if (!invoice) {
    return NextResponse.json({ message: "Rechnung nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ invoice });
}
