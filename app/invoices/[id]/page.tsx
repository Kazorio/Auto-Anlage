"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Invoice } from "@/types/domain";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    params.then(async ({ id }) => {
      const response = await fetch(`/api/invoices/${id}`);
      if (!response.ok) {
        setError("Rechnung nicht gefunden.");
        return;
      }
      const data = await response.json();
      setInvoice(data.invoice);
    });
  }, [params]);

  if (error) {
    return (
      <main className="container grid page-stack">
        <section className="card grid" style={{ gap: 10 }}>
          <p>{error}</p>
          <Link href="/invoices">Zurück</Link>
        </section>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="container">
        <section className="card">Lade Rechnung...</section>
      </main>
    );
  }

  // Anzahl Aufträge in dieser Rechnung
  const orderCount = invoice.orderIds?.length || 1;

  return (
    <main className="container grid page-stack invoice-sheet">
      <div className="page-header no-print">
        <h1>Rechnung {invoice.invoiceNumber}</h1>
        <div className="actions">
          <Link href="/invoices">Zurück</Link>
          <a href={`/api/invoices/${invoice.id}/pdf`}>PDF herunterladen</a>
          <button type="button" onClick={() => window.print()}>
            Drucken
          </button>
        </div>
      </div>

      <section className="card">
        <div className="invoice-header">
          <h1 className="invoice-title">Rechnung</h1>
          <div className="invoice-number">{invoice.invoiceNumber}</div>
        </div>

        <div className="invoice-meta">
          <div className="invoice-meta-item">
            <h4>Kunde</h4>
            <p>{invoice.customerName}</p>
          </div>
          <div className="invoice-meta-item">
            <h4>Datum</h4>
            <p>{new Date(invoice.createdAt).toLocaleDateString("de-DE")}</p>
          </div>
          <div className="invoice-meta-item">
            <h4>Aufträge</h4>
            <p>{orderCount} Fahrzeug{orderCount !== 1 ? "e" : ""}</p>
          </div>
          <div className="invoice-meta-item">
            <h4>Status</h4>
            <p>
              <span className={`badge ${invoice.status === "paid" ? "badge-paid" : "badge-open"}`}>
                {invoice.status === "paid" ? "Bezahlt" : "Offen"}
              </span>
            </p>
          </div>
        </div>

        <div className="invoice-items">
          <h3>Leistungspositionen</h3>
          
          <div className="table-wrap" style={{ marginTop: "16px" }}>
            <table>
              <thead>
                <tr>
                  <th>Fahrzeug</th>
                  <th>Kennzeichen</th>
                  <th>Leistung</th>
                  <th style={{ textAlign: "right" }}>Preis</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, idx) => (
                  <tr key={`${item.orderId}-${idx}`}>
                    <td>{item.vehicleModel || "—"}</td>
                    <td>{item.licensePlate || "—"}</td>
                    <td>{item.label}</td>
                    <td style={{ textAlign: "right" }}>{item.price.toFixed(2)} EUR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="invoice-total">
          <div className="invoice-total-label">Gesamt</div>
          <div className="invoice-total-value">{invoice.total.toFixed(2)} EUR</div>
        </div>
      </section>
    </main>
  );
}
