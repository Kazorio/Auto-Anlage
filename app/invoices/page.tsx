"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { getInvoiceRuntimeStage, getInvoiceStatusLabel, InvoiceRuntimeStage } from "@/lib/invoices";
import { Invoice } from "@/types/domain";

type InvoiceFilter = "all" | InvoiceRuntimeStage;

type RuntimeInvoice = Invoice & {
  runtimeStage: InvoiceRuntimeStage;
};

const phaseOrder: InvoiceRuntimeStage[] = ["created", "sent", "overdue", "paid"];

const phaseLabel: Record<InvoiceRuntimeStage, string> = {
  created: "Erstellt (zu versenden)",
  sent: "Abgeschickt (warte auf Zahlung)",
  overdue: "Überfällig (Warnung)",
  paid: "Bezahlt"
};

const filterLabel: Record<InvoiceFilter, string> = {
  all: "Alle",
  created: "Zu versenden",
  sent: "Warte auf Zahlung",
  overdue: "Überfällig",
  paid: "Bezahlt"
};

function formatDate(value?: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("de-DE");
}

function getPhaseBadgeClass(stage: InvoiceRuntimeStage): string {
  if (stage === "paid") return "badge-paid";
  if (stage === "sent") return "badge-sent";
  if (stage === "overdue") return "badge-overdue";
  return "badge-created";
}

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeFilter, setActiveFilter] = useState<InvoiceFilter>("all");
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/invoices");
    const data = await response.json();
    setInvoices(data.invoices ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  const runtimeInvoices = useMemo<RuntimeInvoice[]>(() => {
    const now = new Date();
    return invoices
      .map((invoice) => ({ ...invoice, runtimeStage: getInvoiceRuntimeStage(invoice, now) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [invoices]);

  const openTotal = useMemo(
    () =>
      runtimeInvoices
        .filter((invoice) => invoice.runtimeStage !== "paid")
        .reduce((sum, invoice) => sum + invoice.totalGross, 0),
    [runtimeInvoices]
  );

  const phaseCounts = useMemo(() => {
    return runtimeInvoices.reduce(
      (acc, invoice) => {
        acc[invoice.runtimeStage] += 1;
        return acc;
      },
      { created: 0, sent: 0, overdue: 0, paid: 0 } as Record<InvoiceRuntimeStage, number>
    );
  }, [runtimeInvoices]);

  const filteredInvoices = useMemo(() => {
    if (activeFilter === "all") {
      return runtimeInvoices;
    }

    return runtimeInvoices.filter((invoice) => invoice.runtimeStage === activeFilter);
  }, [activeFilter, runtimeInvoices]);

  const groupedRows = useMemo(() => {
    if (activeFilter !== "all") {
      return [{ phase: activeFilter, invoices: filteredInvoices }];
    }

    return phaseOrder
      .map((phase) => ({
        phase,
        invoices: filteredInvoices.filter((invoice) => invoice.runtimeStage === phase)
      }))
      .filter((group) => group.invoices.length > 0);
  }, [activeFilter, filteredInvoices]);

  async function markSent(id: string) {
    setMessage("");
    const response = await fetch(`/api/invoices/${id}/sent`, { method: "PATCH" });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Rechnung konnte nicht als abgeschickt markiert werden." }));
      setMessage(error.message || "Rechnung konnte nicht als abgeschickt markiert werden.");
      return;
    }

    setMessage("Rechnung wurde als abgeschickt markiert.");
    await load();
  }

  async function markPaid(id: string) {
    setMessage("");
    const response = await fetch(`/api/invoices/${id}/paid`, { method: "PATCH" });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Zahlung konnte nicht bestätigt werden." }));
      setMessage(error.message || "Zahlung konnte nicht bestätigt werden.");
      return;
    }

    setMessage("Zahlungseingang wurde bestätigt.");
    await load();
  }

  return (
    <main className="container grid page-stack">
      <div className="page-header">
        <h1>Auto-Aufbereitung</h1>
        <nav className="header-nav" aria-label="Hauptnavigation">
          <Link href="/" className="header-tab">
            Aufträge
          </Link>
          <Link href="/invoices" className="header-tab header-tab-active">
            Rechnungen
          </Link>
        </nav>
      </div>

      <section className="card">
        <h3>Offener Betrag</h3>
        <div className="kpi-value">{openTotal.toFixed(2)} EUR</div>
      </section>

      <section className="card">
        {message ? <p className="invoice-status-message">{message}</p> : null}

        <div className="invoice-filter-row">
          {(["all", "created", "sent", "overdue", "paid"] as InvoiceFilter[]).map((filterKey) => {
            const count = filterKey === "all" ? runtimeInvoices.length : phaseCounts[filterKey as InvoiceRuntimeStage];

            return (
              <button
                key={filterKey}
                type="button"
                className={`invoice-filter-button ${activeFilter === filterKey ? "invoice-filter-button-active" : ""}`}
                onClick={() => setActiveFilter(filterKey)}
              >
                {filterLabel[filterKey]} ({count})
              </button>
            );
          })}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Kunde</th>
                <th>Anzahl Aufträge</th>
                <th>Gesamt (brutto)</th>
                <th>Versandt am</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "#6b7280" }}>
                    Keine Rechnungen für diese Ansicht.
                  </td>
                </tr>
              ) : (
                groupedRows.map((group) => (
                  <Fragment key={`rows-${group.phase}`}>
                    {activeFilter === "all" ? (
                      <tr className="invoice-group-row">
                        <td colSpan={7}>
                          {phaseLabel[group.phase as InvoiceRuntimeStage]} ({group.invoices.length})
                        </td>
                      </tr>
                    ) : null}
                    {group.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>{invoice.invoiceNumber}</td>
                        <td>{invoice.customerName}</td>
                        <td>{invoice.orderIds.length}</td>
                        <td>{invoice.totalGross.toFixed(2)} EUR</td>
                        <td>{formatDate(invoice.sentAt)}</td>
                        <td>
                          <span className={`badge ${getPhaseBadgeClass(invoice.runtimeStage)}`}>
                            {getInvoiceStatusLabel(invoice.runtimeStage)}
                          </span>
                        </td>
                        <td>
                          <div className="actions invoice-actions-row">
                            <Link href={`/invoices/${invoice.id}`} className="invoice-action-link">
                              <span aria-hidden="true">🖨</span>
                              <span>Drucken</span>
                            </Link>
                            <a href={`/api/invoices/${invoice.id}/pdf`} className="invoice-action-link">
                              <span aria-hidden="true">📄</span>
                              <span>PDF</span>
                            </a>
                            {invoice.runtimeStage === "created" ? (
                              <button className="secondary" type="button" onClick={() => markSent(invoice.id)}>
                                Als abgeschickt markieren
                              </button>
                            ) : null}
                            {invoice.runtimeStage === "sent" || invoice.runtimeStage === "overdue" ? (
                              <button type="button" onClick={() => markPaid(invoice.id)}>
                                Zahlungseingang bestätigen
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
