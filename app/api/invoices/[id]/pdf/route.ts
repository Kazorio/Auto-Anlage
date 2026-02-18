import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readDb } from "@/lib/storage";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const { id } = await context.params;
  const db = await readDb();
  const invoice = db.invoices.find((item) => item.id === id);

  if (!invoice) {
    return NextResponse.json({ message: "Rechnung nicht gefunden." }, { status: 404 });
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 790;
  
  // Header
  page.drawText(`Rechnung ${invoice.invoiceNumber}`, { x: 50, y, size: 20, font: bold, color: rgb(0, 0, 0) });
  y -= 35;
  page.drawText(`Kunde: ${invoice.customerName}`, { x: 50, y, size: 12, font });
  y -= 18;
  page.drawText(`Datum: ${new Date(invoice.createdAt).toLocaleDateString("de-DE")}`, { x: 50, y, size: 12, font });
  y -= 18;
  
  const orderCount = invoice.orderIds?.length || 1;
  page.drawText(`Fahrzeuge: ${orderCount}`, { x: 50, y, size: 12, font });
  y -= 30;

  // Tabellenkopf
  page.drawText("Leistungspositionen", { x: 50, y, size: 13, font: bold });
  y -= 20;
  
  // Spaltenüberschriften
  page.drawText("Fahrzeug", { x: 50, y, size: 10, font: bold });
  page.drawText("Kennzeichen", { x: 160, y, size: 10, font: bold });
  page.drawText("Leistung", { x: 260, y, size: 10, font: bold });
  page.drawText("Preis", { x: 480, y, size: 10, font: bold });
  y -= 4;
  
  // Linie unter Header
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: rgb(0, 0, 0) });
  y -= 12;

  // Zeilen
  for (const item of invoice.lineItems) {
    if (y < 50) {
      // Neue Seite wenn nicht genug Platz
      const newPage = pdf.addPage([595, 842]);
      y = 790;
      page.drawText("Fahrzeug", { x: 50, y, size: 10, font: bold });
      page.drawText("Kennzeichen", { x: 160, y, size: 10, font: bold });
      page.drawText("Leistung", { x: 260, y, size: 10, font: bold });
      page.drawText("Preis", { x: 480, y, size: 10, font: bold });
      y -= 16;
    }
    
    const vehicleText = (item.vehicleModel || "—").substring(0, 18);
    const plateText = (item.licensePlate || "—").substring(0, 15);
    const labelText = item.label.substring(0, 35);
    
    page.drawText(vehicleText, { x: 50, y, size: 9, font });
    page.drawText(plateText, { x: 160, y, size: 9, font });
    page.drawText(labelText, { x: 260, y, size: 9, font });
    page.drawText(`${item.price.toFixed(2)} EUR`, { x: 480, y, size: 9, font });
    y -= 14;
  }

  // Linie vor Summe
  y -= 8;
  page.drawLine({ start: { x: 400, y }, end: { x: 545, y }, thickness: 1, color: rgb(0, 0, 0) });
  y -= 16;

  // Summe
  page.drawText("Gesamt:", { x: 400, y, size: 12, font: bold });
  page.drawText(`${invoice.total.toFixed(2)} EUR`, { x: 480, y, size: 12, font: bold });
  y -= 25;
  
  // Status
  const statusText = invoice.status === "paid" ? "Bezahlt" : "Offen";
  const statusColor = invoice.status === "paid" ? rgb(0.1, 0.6, 0.1) : rgb(0.8, 0.4, 0);
  page.drawText(`Status: ${statusText}`, { x: 50, y, size: 11, font, color: statusColor });

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Rechnung-${invoice.invoiceNumber}.pdf`
    }
  });
}
