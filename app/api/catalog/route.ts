import { NextResponse } from "next/server";
import { addonServices, baseServices } from "@/data/catalog";

export async function GET() {
  return NextResponse.json({ baseServices, addonServices });
}
