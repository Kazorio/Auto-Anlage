import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getInvoiceRuntimeStage, getInvoiceStatusLabel } from "@/lib/invoices";
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
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const left = 50;
  const right = 545;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 52;

  const dateText = new Date(invoice.createdAt).toLocaleDateString("de-DE");
  const statusText = invoice.status === "paid" ? "Bezahlt" : "Offen";

  const drawTableHeader = () => {
    page.drawText("Pos", { x: left, y, size: 9, font: bold });
    page.drawText("Prog", { x: 85, y, size: 9, font: bold });
    page.drawText("VIN/KZ", { x: 130, y, size: 9, font: bold });
    page.drawText("Einzelpreis netto", { x: 300, y, size: 9, font: bold });
    page.drawText("Extras netto", { x: 400, y, size: 9, font: bold });
    page.drawText("Gesamt netto", { x: 490, y, size: 9, font: bold });
    y -= 6;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 12;
  };

  const drawPageHeader = () => {
    page.drawText("Rechnung", { x: left, y, size: 20, font: bold, color: rgb(0, 0, 0) });
    page.drawText(invoice.invoiceNumber, { x: 430, y, size: 12, font: bold, color: rgb(0, 0, 0) });
    y -= 24;

    page.drawText("Absender", { x: left, y, size: 10, font: bold });
    page.drawText("Empfänger", { x: 300, y, size: 10, font: bold });
    y -= 14;

    page.drawText(invoice.issuer.name, { x: left, y, size: 10, font });
    page.drawText(invoice.customerName, { x: 300, y, size: 10, font });
    y -= 13;

    if (invoice.issuer.address) {
      page.drawText(invoice.issuer.address, { x: left, y, size: 9, font });
    }
    const recipientAddress = db.customers.find((customer) => customer.id === invoice.customerId)?.address;
    if (recipientAddress) {
      page.drawText(recipientAddress, { x: 300, y, size: 9, font });
    }
    y -= 18;

    page.drawText(`Datum: ${dateText}`, { x: left, y, size: 9, font });
    page.drawText(`Status: ${statusText}`, { x: 300, y, size: 9, font });
    y -= 24;

    drawTableHeader();
  };

  drawPageHeader();

  for (const item of invoice.lineItems) {
    if (y < 110) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - 52;
      drawPageHeader();
    }

    const vinKz = `${item.vin || "-"} / ${item.licensePlate || "-"}`;

    page.drawText(String(item.position), { x: left, y, size: 9, font });
    page.drawText(String(item.programNumber), { x: 88, y, size: 9, font });
    page.drawText(vinKz.slice(0, 28), { x: 130, y, size: 9, font });
    page.drawText(`${item.unitNet.toFixed(2)} EUR`, { x: 300, y, size: 9, font });
    page.drawText(`${item.extrasNet.toFixed(2)} EUR`, { x: 400, y, size: 9, font });
    page.drawText(`${item.totalNet.toFixed(2)} EUR`, { x: 490, y, size: 9, font });
    y -= 13;
  }

  y -= 6;
  page.drawLine({ start: { x: 290, y }, end: { x: right, y }, thickness: 1, color: rgb(0, 0, 0) });
  y -= 16;

  page.drawText("Gesamtnetto:", { x: 320, y, size: 10, font: bold });
  page.drawText(`${invoice.subtotalNet.toFixed(2)} EUR`, { x: 490, y, size: 10, font: bold });
  y -= 14;

  page.drawText(`MwSt (${Math.round(invoice.taxRate * 100)}%):`, { x: 320, y, size: 10, font: bold });
  page.drawText(`${invoice.taxAmount.toFixed(2)} EUR`, { x: 490, y, size: 10, font: bold });
  y -= 14;

  page.drawText("Gesamtbrutto:", { x: 320, y, size: 11, font: bold });
  page.drawText(`${invoice.totalGross.toFixed(2)} EUR`, { x: 490, y, size: 11, font: bold });
  y -= 24;

  page.drawText("Legende Programme", { x: left, y, size: 10, font: bold });
  y -= 12;

  const legendEntries = Array.from(
    new Map(invoice.lineItems.map((item) => [item.programNumber, item.programLabel])).entries()
  ).sort((a, b) => a[0] - b[0]);

  for (const [programNumber, label] of legendEntries) {
    if (y < 40) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - 52;
    }
    page.drawText(`${programNumber}: ${label}`, { x: left, y, size: 9, font });
    y -= 12;
  }

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=Rechnung-${invoice.invoiceNumber}.pdf`
    }
  });
}
