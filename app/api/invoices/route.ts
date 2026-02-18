import { NextResponse } from "next/server";
import { readDb } from "@/lib/storage";

export async function GET() {
  const db = await readDb();
  const invoices = [...db.invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ invoices, orders: db.orders });
}
