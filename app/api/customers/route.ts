import { NextResponse } from "next/server";
import { createCustomerId, mutateDb, readDb } from "@/lib/storage";
import { Customer } from "@/types/domain";

export async function GET() {
  const db = await readDb();
  return NextResponse.json({ customers: db.customers });
}

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.name) {
    return NextResponse.json({ message: "Name erforderlich." }, { status: 400 });
  }

  const newCustomer: Customer = {
    id: createCustomerId(),
    name: body.name,
    shortName: body.shortName,
    address: body.address,
    email: body.email,
    phone: body.phone,
    createdAt: new Date().toISOString()
  };

  const updated = await mutateDb((db) => {
    db.customers.push(newCustomer);
    return db;
  });

  return NextResponse.json({ customer: newCustomer, customers: updated.customers }, { status: 201 });
}
