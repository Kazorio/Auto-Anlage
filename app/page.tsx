"use client";

import styles from "./page.module.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getInvoiceRuntimeStage, getInvoiceStatusLabel } from "@/lib/invoices";
import { Customer, Invoice, Order } from "@/types/domain";

type WeeklyInvoiceState = {
  selectedCustomerIds: string[];
};

type OrderView = "uninvoiced" | "invoiced";
type WeeklyOutstandingTile = {
  key: string;
  weekStart: Date;
  week: number;
  year: number;
  openCount: number;
  isSelected: boolean;
};

function getIsoWeekStart(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - (day - 1));
  return value;
}

function getIsoWeekEnd(weekStart: Date): Date {
  const value = new Date(weekStart);
  value.setDate(value.getDate() + 6);
  value.setHours(23, 59, 59, 999);
  return value;
}

function shiftIsoWeek(weekStart: Date, delta: number): Date {
  const value = new Date(weekStart);
  value.setDate(value.getDate() + delta * 7);
  value.setHours(0, 0, 0, 0);
  return value;
}

function getIsoWeekInfo(date: Date): { week: number; year: number } {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const year = target.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year };
}

function getIsoWeekKey(date: Date): string {
  const weekStart = getIsoWeekStart(date);
  const { week, year } = getIsoWeekInfo(weekStart);
  return `${year}-W${String(week).padStart(2, "0")}`;
}
function formatDateDE(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatOrderDate(value?: string): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return formatDateDE(parsed);
}

function isInRangeInclusive(isoDate: string | undefined, start: Date, end: Date): boolean {
  if (!isoDate) return false;
  const value = new Date(isoDate).getTime();
  return value >= start.getTime() && value <= end.getTime();
}

export default function HomePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [message, setMessage] = useState<string>("");

  const [showWeeklyInvoiceModal, setShowWeeklyInvoiceModal] = useState(false);
  const [weeklyInvoiceState, setWeeklyInvoiceState] = useState<WeeklyInvoiceState>({
    selectedCustomerIds: []
  });
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => getIsoWeekStart(new Date()));
  const [isCreatingInvoices, setIsCreatingInvoices] = useState(false);
  const [orderView, setOrderView] = useState<OrderView>("uninvoiced");
  const [customerFilterId, setCustomerFilterId] = useState<string>("all");

  async function loadAll() {
    const [ordersResponse, customersResponse] = await Promise.all([fetch("/api/orders"), fetch("/api/customers")]);
    const ordersData = await ordersResponse.json();
    const customersData = await customersResponse.json();

    setOrders(ordersData.orders ?? []);
    setInvoices(ordersData.invoices ?? []);
    setCustomers(customersData.customers ?? []);
  }

  useEffect(() => {
    loadAll().catch(() => setMessage("Fehler beim Laden der Daten."));
  }, []);

  const invoiceMap = useMemo(() => new Map(invoices.map((item) => [item.id, item])), [invoices]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const notInvoiced = orders.filter((order) => !order.invoiceId).length;
    const totalInvoices = invoices.length;
    const unpaid = invoices.filter((invoice) => invoice.status !== "paid").length;
    return { totalOrders, notInvoiced, totalInvoices, unpaid };
  }, [orders, invoices]);

  const weekStart = useMemo(() => getIsoWeekStart(selectedWeekStart), [selectedWeekStart]);
  const weekEnd = useMemo(() => getIsoWeekEnd(weekStart), [weekStart]);
  const isoWeek = useMemo(() => getIsoWeekInfo(weekStart), [weekStart]);
  const weeklyOutstandingTiles = useMemo<WeeklyOutstandingTile[]>(() => {
    const currentWeekStart = getIsoWeekStart(new Date());
    const maxLookbackStart = shiftIsoWeek(currentWeekStart, -39);

    const countByWeek = new Map<string, { weekStart: Date; count: number }>();
    let earliestWeekStart: Date | null = null;

    for (const order of orders) {
      if (order.invoiceId) {
        continue;
      }

      const referenceDate = new Date(order.completedAt ?? order.createdAt);
      if (Number.isNaN(referenceDate.getTime())) {
        continue;
      }

      const orderWeekStart = getIsoWeekStart(referenceDate);
      if (orderWeekStart.getTime() > currentWeekStart.getTime()) {
        continue;
      }

      const boundedWeekStart =
        orderWeekStart.getTime() < maxLookbackStart.getTime() ? maxLookbackStart : orderWeekStart;

      const key = getIsoWeekKey(boundedWeekStart);
      const existing = countByWeek.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        countByWeek.set(key, { weekStart: boundedWeekStart, count: 1 });
      }

      if (!earliestWeekStart || boundedWeekStart.getTime() < earliestWeekStart.getTime()) {
        earliestWeekStart = boundedWeekStart;
      }
    }

    const rangeStart = earliestWeekStart ?? currentWeekStart;
    const selectedKey = getIsoWeekKey(selectedWeekStart);
    const tiles: WeeklyOutstandingTile[] = [];

    for (let cursor = new Date(rangeStart); cursor.getTime() <= currentWeekStart.getTime(); cursor = shiftIsoWeek(cursor, 1)) {
      const key = getIsoWeekKey(cursor);
      const info = getIsoWeekInfo(cursor);
      const count = countByWeek.get(key)?.count ?? 0;

      tiles.push({
        key,
        weekStart: new Date(cursor),
        week: info.week,
        year: info.year,
        openCount: count,
        isSelected: key === selectedKey
      });
    }

    return tiles.reverse();
  }, [orders, selectedWeekStart]);

  const customersWithUninvoicedOrders = useMemo(() => {
    const customerMap = new Map<string, { customer: Customer; orderCount: number }>();

    for (const order of orders) {
      if (!order.invoiceId && isInRangeInclusive(order.completedAt ?? order.createdAt, weekStart, weekEnd)) {
        const customer = customers.find((item) => item.id === order.customerId);
        if (!customer) continue;

        const existing = customerMap.get(customer.id);
        if (existing) {
          existing.orderCount += 1;
        } else {
          customerMap.set(customer.id, { customer, orderCount: 1 });
        }
      }
    }

    return Array.from(customerMap.values()).sort((a, b) => a.customer.name.localeCompare(b.customer.name));
  }, [orders, customers, weekStart, weekEnd]);

  const uninvoicedOrders = useMemo(() => orders.filter((order) => !order.invoiceId), [orders]);
  const invoicedOrders = useMemo(() => orders.filter((order) => Boolean(order.invoiceId)), [orders]);
  const visibleOrders = orderView === "uninvoiced" ? uninvoicedOrders : invoicedOrders;

  const filteredOrders = useMemo(() => {
    if (customerFilterId === "all") {
      return visibleOrders;
    }

    return visibleOrders.filter((order) => order.customerId === customerFilterId);
  }, [visibleOrders, customerFilterId]);

  function changeWeek(delta: number) {
    setSelectedWeekStart((prev) => shiftIsoWeek(prev, delta));
    setWeeklyInvoiceState({ selectedCustomerIds: [] });
  }
  function selectWeek(weekStartDate: Date) {
    setSelectedWeekStart(getIsoWeekStart(weekStartDate));
    setWeeklyInvoiceState({ selectedCustomerIds: [] });
  }

  function openWeeklyModal() {
    setShowWeeklyInvoiceModal(true);
    setWeeklyInvoiceState({ selectedCustomerIds: [] });
  }

  function closeWeeklyModal() {
    setShowWeeklyInvoiceModal(false);
    setWeeklyInvoiceState({ selectedCustomerIds: [] });
  }

  async function handleWeeklyInvoiceSubmit() {
    setMessage("");

    if (weeklyInvoiceState.selectedCustomerIds.length === 0) {
      setMessage("Bitte mindestens einen Kunden auswählen.");
      return;
    }

    setIsCreatingInvoices(true);

    try {
      const response = await fetch("/api/invoices/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerIds: weeklyInvoiceState.selectedCustomerIds,
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString()
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Wochenabrechnung fehlgeschlagen." }));
        setMessage(err.message || "Wochenabrechnung fehlgeschlagen.");
        return;
      }

      const data = await response.json();
      const count = data.invoices?.length || 0;
      const skipped = data.skippedCustomers?.length || 0;

      let resultMessage = `✔ ${count} Rechnung${count !== 1 ? "en" : ""} erfolgreich erstellt.`;
      if (skipped > 0) {
        resultMessage += ` (${skipped} Kunde${skipped !== 1 ? "n" : ""} übersprungen - keine passenden Aufträge)`;
      }

      setMessage(resultMessage);
      closeWeeklyModal();
      await loadAll();
    } catch {
      setMessage("Fehler bei der Rechnungserstellung.");
    } finally {
      setIsCreatingInvoices(false);
    }
  }

  function toggleCustomerSelection(customerId: string) {
    setWeeklyInvoiceState((prev) => ({
      ...prev,
      selectedCustomerIds: prev.selectedCustomerIds.includes(customerId)
        ? prev.selectedCustomerIds.filter((id) => id !== customerId)
        : [...prev.selectedCustomerIds, customerId]
    }));
  }

  return (
    <main className={`${styles.container} ${styles.pageStack}`}>
      <div className={styles.pageHeader}>
        <h1>Auto-Aufbereitung</h1>
        <nav className={styles.headerNav} aria-label="Hauptnavigation">
          <Link href="/" className={`${styles.headerTab} ${styles.headerTabActive}`}>
            Aufträge
          </Link>
          <Link href="/invoices" className={styles.headerTab}>
            Rechnungen
          </Link>
        </nav>
      </div>

      <section className={`${styles.grid} ${styles.grid4}`}>
        <article className={styles.card}>
          <h3>Aufträge gesamt</h3>
          <div className={styles.kpiValue}>{stats.totalOrders}</div>
        </article>
        <article className={styles.card}>
          <h3>Noch nicht abgerechnet</h3>
          <div className={styles.kpiValue}>{stats.notInvoiced}</div>
        </article>
        <article className={styles.card}>
          <h3>Rechnungen offen</h3>
          <div className={styles.kpiValue}>{stats.unpaid}</div>
        </article>
        <article className={styles.card}>
          <h3>Rechnungen gesamt</h3>
          <div className={styles.kpiValue}>{stats.totalInvoices}</div>
        </article>
      </section>

      {message && (
        <div
          className={styles.card}
          style={{
            backgroundColor:
              message.includes("✔") || message.includes("erfolg")
                ? "#d4edda"
                : message.includes("Fehler")
                  ? "#f8d7da"
                  : "#d1ecf1",
            borderLeft: `4px solid ${
              message.includes("✔") || message.includes("erfolg")
                ? "#28a745"
                : message.includes("Fehler")
                  ? "#dc3545"
                  : "#0c5460"
            }`,
            padding: "12px 16px"
          }}
        >
          <p style={{ margin: 0, color: "#000" }}>{message}</p>
        </div>
      )}

      {showWeeklyInvoiceModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}
        >
          <div
            className={styles.card}
            style={{ maxWidth: "600px", width: "90%", maxHeight: "80vh", overflow: "auto", margin: "20px" }}
          >
            <h2>Wochenabrechnung erstellen</h2>

            <div className={styles.weekSelector}>
              <button
                type="button"
                className={styles.weekArrow}
                onClick={() => changeWeek(-1)}
                disabled={isCreatingInvoices}
                aria-label="Vorherige Woche"
              >
                ←
              </button>
              <div className={styles.weekInfo}>
                <strong>
                  KW {isoWeek.week}/{isoWeek.year}
                </strong>
                <div className={styles.weekRange}>
                  von {formatDateDE(weekStart)} bis {formatDateDE(weekEnd)}
                </div>
              </div>
              <button
                type="button"
                className={styles.weekArrow}
                onClick={() => changeWeek(1)}
                disabled={isCreatingInvoices}
                aria-label="Nächste Woche"
              >
                →
              </button>
            </div>

            <div style={{ marginTop: 20 }}>
              <h3>Kalenderwochen mit offenen Aufträgen</h3>
              <div className={styles.weekTiles}>
                {weeklyOutstandingTiles.map((tile) => (
                  <button
                    key={tile.key}
                    type="button"
                    className={`${styles.weekTile} ${tile.isSelected ? styles.weekTileActive : ""} ${
                      tile.openCount === 0 ? styles.weekTileEmpty : ""
                    }`}
                    onClick={() => selectWeek(tile.weekStart)}
                    disabled={isCreatingInvoices}
                  >
                    <span className={styles.weekTileLabel}>KW {tile.week}/{tile.year}</span>
                    {tile.openCount > 0 ? <span className={styles.weekTileCount}>{tile.openCount}</span> : null}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <h3>Kunden mit nicht abgerechneten Aufträgen:</h3>
              {customersWithUninvoicedOrders.length === 0 ? (
                <p style={{ color: "#666", fontStyle: "italic" }}>
                  Keine Kunden mit offenen Aufträgen in dieser Woche gefunden.
                </p>
              ) : (
                <div className={styles.customerList}>
                  {customersWithUninvoicedOrders.map(({ customer, orderCount }) => (
                    <label key={customer.id} className={styles.customerRow}>
                      <input
                        type="checkbox"
                        checked={weeklyInvoiceState.selectedCustomerIds.includes(customer.id)}
                        onChange={() => toggleCustomerSelection(customer.id)}
                        disabled={isCreatingInvoices}
                      />
                      <span>
                        {customer.name} ({orderCount} Auftrag{orderCount !== 1 ? "e" : ""})
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.actions} style={{ marginTop: 20 }}>
              <button
                type="button"
                onClick={handleWeeklyInvoiceSubmit}
                disabled={weeklyInvoiceState.selectedCustomerIds.length === 0 || isCreatingInvoices}
                style={{ opacity: isCreatingInvoices ? 0.6 : 1, cursor: isCreatingInvoices ? "wait" : "pointer" }}
              >
                {isCreatingInvoices ? "Erstelle Rechnungen..." : "Rechnungen erstellen"}
              </button>
              <button type="button" className="secondary" onClick={closeWeeklyModal} disabled={isCreatingInvoices}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      <section className={styles.card}>
        <div className={styles.ordersHeader}>
          <h2>Aufträge</h2>
          <div className={styles.ordersActions}>
            <button type="button" onClick={openWeeklyModal}>
              Abrechnung erstellen
            </button>
            <Link href="/orders/new" className={styles.actionLink}>
              Neuen Auftrag erfassen
            </Link>
          </div>
        </div>

        <div className={styles.orderControls}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tabButton} ${orderView === "uninvoiced" ? styles.tabButtonActive : ""}`}
              onClick={() => setOrderView("uninvoiced")}
            >
              Nicht in Rechnung überführt ({uninvoicedOrders.length})
            </button>
            <button
              type="button"
              className={`${styles.tabButton} ${orderView === "invoiced" ? styles.tabButtonActive : ""}`}
              onClick={() => setOrderView("invoiced")}
            >
              In Rechnung überführt ({invoicedOrders.length})
            </button>
          </div>

          <div className={styles.filterWrap}>
            <label>
              Kunde filtern
              <select value={customerFilterId} onChange={(e) => setCustomerFilterId(e.target.value)}>
                <option value="all">Alle Kunden</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className={styles.tableWrap} style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Kunde</th>
                <th>Kennzeichen</th>
                <th>Modell</th>
                <th>Prog.</th>
                <th>Datum</th>
                <th>Rechnung</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "#6b7280" }}>
                    Keine Aufträge in dieser Ansicht.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const linkedInvoice = order.invoiceId ? invoiceMap.get(order.invoiceId) : undefined;
                  const orderWithCustomerName = order as Order & { customerName?: string };
                  return (
                    <tr key={order.id}>
                      <td>{orderWithCustomerName.customerName || "Unbekannt"}</td>
                      <td>{order.licensePlate}</td>
                      <td>{order.vehicleModel}</td>
                      <td>{order.programNumber}</td>
                      <td>{formatOrderDate(order.completedAt ?? order.createdAt)}</td>
                      <td>
                        {linkedInvoice ? (
                          <Link href={`/invoices/${order.invoiceId}`}>
                            <span
                              className={`${styles.badge} ${
                                getInvoiceRuntimeStage(linkedInvoice) === "paid"
                                  ? styles.badgePaid
                                  : getInvoiceRuntimeStage(linkedInvoice) === "overdue"
                                    ? styles.badgeOverdue
                                    : getInvoiceRuntimeStage(linkedInvoice) === "sent"
                                      ? styles.badgeSent
                                      : styles.badgeOpen
                              }`}
                            >
                              {linkedInvoice.invoiceNumber} ({getInvoiceStatusLabel(getInvoiceRuntimeStage(linkedInvoice))})
                            </span>
                          </Link>
                        ) : (
                          <span className={`${styles.badge} ${styles.badgeNone}`}>Nicht erstellt</span>
                        )}
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <Link href={`/orders/new?editId=${order.id}`}>Bearbeiten</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}




