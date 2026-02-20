"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getInvoiceDueDate, getInvoiceRuntimeStage, getInvoiceStatusLabel, InvoiceRuntimeStage } from "@/lib/invoices";
import { Invoice } from "@/types/domain";

function getStatusClass(stage: InvoiceRuntimeStage): string {
  if (stage === "paid") return "badge-paid";
  if (stage === "sent") return "badge-sent";
  if (stage === "overdue") return "badge-overdue";
  return "badge-created";
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("de-DE");
}

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

  const runtimeStage = useMemo(() => {
    if (!invoice) return "created" as InvoiceRuntimeStage;
    return getInvoiceRuntimeStage(invoice);
  }, [invoice]);

  const dueDate = useMemo(() => {
    if (!invoice) return null;
    return getInvoiceDueDate(invoice);
  }, [invoice]);

  const programLegend = useMemo(() => {
    if (!invoice) return [] as Array<[number, string]>;
    return Array.from(
      new Map(invoice.lineItems.map((item) => [item.programNumber, item.programLabel])).entries()
    ).sort((a, b) => a[0] - b[0]);
  }, [invoice]);

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

  return (
    <main className="container grid page-stack invoice-sheet">
      <div className="page-header no-print">
        <h1>Rechnung {invoice.invoiceNumber}</h1>
        <nav className="header-nav" aria-label="Hauptnavigation">
          <Link href="/" className="header-tab">
            Aufträge
          </Link>
          <Link href="/invoices" className="header-tab header-tab-active">
            Rechnungen
          </Link>
        </nav>
      </div>

      <section className="card no-print" style={{ paddingTop: 20, paddingBottom: 20 }}>
        <div className="actions">
          <Link href="/invoices">Zurück</Link>
          <a href={`/api/invoices/${invoice.id}/pdf`}>PDF herunterladen</a>
          <button type="button" onClick={() => window.print()}>
            Drucken
          </button>
        </div>
      </section>

      <section className="card">
        <div className="invoice-header">
          <h1 className="invoice-title">Rechnung</h1>
          <div className="invoice-number">{invoice.invoiceNumber}</div>
        </div>

        <div className="invoice-meta" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <div className="invoice-meta-item">
            <h4>Absender (Firma)</h4>
            <p>{invoice.issuer.name}</p>
            {invoice.issuer.address ? <p>{invoice.issuer.address}</p> : null}
          </div>
          <div className="invoice-meta-item">
            <h4>Empfänger</h4>
            <p>{invoice.customerName}</p>
          </div>
          <div className="invoice-meta-item">
            <h4>Datum</h4>
            <p>{new Date(invoice.createdAt).toLocaleDateString("de-DE")}</p>
          </div>
          <div className="invoice-meta-item">
            <h4>Status</h4>
            <p>
              <span className={`badge ${getStatusClass(runtimeStage)}`}>{getInvoiceStatusLabel(runtimeStage)}</span>
            </p>
          </div>
          <div className="invoice-meta-item">
            <h4>Versandt am</h4>
            <p>{formatDate(invoice.sentAt)}</p>
          </div>
          <div className="invoice-meta-item">
            <h4>Fällig bis</h4>
            <p>{dueDate ? dueDate.toLocaleDateString("de-DE") : "-"}</p>
          </div>
        </div>

        <div className="invoice-items">
          <h3>Leistungspositionen</h3>

          <div className="table-wrap" style={{ marginTop: "16px" }}>
            <table>
              <thead>
                <tr>
                  <th>Pos.</th>
                  <th>Prog.</th>
                  <th>VIN/KZ</th>
                  <th style={{ textAlign: "right" }}>Einzelpreis netto</th>
                  <th style={{ textAlign: "right" }}>Extras netto</th>
                  <th style={{ textAlign: "right" }}>Gesamtpreis netto</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, idx) => (
                  <tr key={`${item.orderId}-${idx}`}>
                    <td>{item.position}</td>
                    <td>{item.programNumber}</td>
                    <td>
                      {item.vin || "-"} / {item.licensePlate || "-"}
                    </td>
                    <td style={{ textAlign: "right" }}>{item.unitNet.toFixed(2)} EUR</td>
                    <td style={{ textAlign: "right" }}>{item.extrasNet.toFixed(2)} EUR</td>
                    <td style={{ textAlign: "right" }}>{item.totalNet.toFixed(2)} EUR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <h4>Legende Programme</h4>
          <ul style={{ margin: "8px 0 0 18px", padding: 0 }}>
            {programLegend.map(([program, label]) => (
              <li key={program}>
                {program}: {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="invoice-total" style={{ display: "grid", gap: 8, justifyItems: "end" }}>
          <div>
            <strong>Gesamtnetto:</strong> {invoice.subtotalNet.toFixed(2)} EUR
          </div>
          <div>
            <strong>MwSt ({Math.round(invoice.taxRate * 100)}%):</strong> {invoice.taxAmount.toFixed(2)} EUR
          </div>
          <div className="invoice-total-value" style={{ fontSize: 28, marginTop: 0 }}>
            Gesamtbrutto: {invoice.totalGross.toFixed(2)} EUR
          </div>
        </div>
      </section>
    </main>
  );
}
