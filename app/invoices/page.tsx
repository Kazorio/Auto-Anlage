"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Invoice } from "@/types/domain";

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  async function load() {
    const response = await fetch("/api/invoices");
    const data = await response.json();
    setInvoices(data.invoices ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const openTotal = useMemo(
    () => invoices.filter((i) => i.status === "open").reduce((sum, i) => sum + i.totalGross, 0),
    [invoices]
  );

  async function markPaid(id: string) {
    const response = await fetch(`/api/invoices/${id}/paid`, { method: "PATCH" });
    if (response.ok) {
      await load();
    }
  }

  return (
    <main className="container grid page-stack">
      <div className="page-header">
        <h1>Rechnungsbereich</h1>
        <Link href="/">Zurück zum Dashboard</Link>
      </div>

      <section className="card">
        <h3>Offener Betrag</h3>
        <div className="kpi-value">{openTotal.toFixed(2)} EUR</div>
      </section>

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Kunde</th>
                <th>Anzahl Aufträge</th>
                <th>Gesamt (brutto)</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoiceNumber}</td>
                  <td>{invoice.customerName}</td>
                  <td>{invoice.orderIds.length}</td>
                  <td>{invoice.totalGross.toFixed(2)} EUR</td>
                  <td>
                    <span className={`badge ${invoice.status === "paid" ? "badge-paid" : "badge-open"}`}>
                      {invoice.status === "paid" ? "Bezahlt" : "Offen"}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <Link href={`/invoices/${invoice.id}`}>Ansehen/Drucken</Link>
                      <a href={`/api/invoices/${invoice.id}/pdf`}>PDF</a>
                      {invoice.status === "open" ? (
                        <button className="secondary" type="button" onClick={() => markPaid(invoice.id)}>
                          Als bezahlt markieren
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

