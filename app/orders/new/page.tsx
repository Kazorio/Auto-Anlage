"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Customer, Order, ServiceItem } from "@/types/domain";

type OrderLineForm = {
  vin: string;
  licensePlate: string;
  programNumber: number;
  vehicleModel: string;
  baseServiceId: string;
  addonServiceIds: string[];
  notes: string;
};

type NewCustomerForm = {
  name: string;
  shortName: string;
  email: string;
  phone: string;
};

const initialCustomerForm: NewCustomerForm = {
  name: "",
  shortName: "",
  email: "",
  phone: ""
};

function toDateInputValue(value?: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function toCompletedAtIso(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function createEmptyLine(baseServiceId = ""): OrderLineForm {
  return {
    vin: "",
    licensePlate: "",
    programNumber: 1,
    vehicleModel: "",
    baseServiceId,
    addonServiceIds: [],
    notes: ""
  };
}

function NewOrderPageContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId");
  const isEditMode = Boolean(editId);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [baseServices, setBaseServices] = useState<ServiceItem[]>([]);
  const [addonServices, setAddonServices] = useState<ServiceItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [completedAt, setCompletedAt] = useState(new Date().toISOString().slice(0, 10));
  const [orderLines, setOrderLines] = useState<OrderLineForm[]>([]);
  const [message, setMessage] = useState("");
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [customerForm, setCustomerForm] = useState<NewCustomerForm>(initialCustomerForm);
  const [isLoading, setIsLoading] = useState(true);
  const [showSavedModal, setShowSavedModal] = useState(false);

  const baseDefaultId = useMemo(() => baseServices[0]?.id || "", [baseServices]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setMessage("");

      try {
        const [catalogResponse, customersResponse, ordersResponse] = await Promise.all([
          fetch("/api/catalog"),
          fetch("/api/customers"),
          isEditMode ? fetch("/api/orders") : Promise.resolve(null)
        ]);

        const catalogData = await catalogResponse.json();
        const customersData = await customersResponse.json();

        const nextCustomers: Customer[] = customersData.customers ?? [];
        const nextBase: ServiceItem[] = catalogData.baseServices ?? [];

        setCustomers(nextCustomers);
        setBaseServices(nextBase);
        setAddonServices(catalogData.addonServices ?? []);

        const defaultCustomerId = nextCustomers[0]?.id || "";
        const defaultBaseId = nextBase[0]?.id || "";

        if (isEditMode && ordersResponse) {
          const ordersData = await ordersResponse.json();
          const order = (ordersData.orders ?? []).find((item: Order) => item.id === editId);

          if (!order) {
            setMessage("Auftrag nicht gefunden.");
            setCustomerId(defaultCustomerId);
            setCompletedAt(new Date().toISOString().slice(0, 10));
            setOrderLines([createEmptyLine(defaultBaseId)]);
          } else {
            setCustomerId(order.customerId);
            setCompletedAt(toDateInputValue(order.completedAt ?? order.createdAt) || new Date().toISOString().slice(0, 10));
            setOrderLines([
              {
                vin: order.vin || "",
                licensePlate: order.licensePlate,
                programNumber: order.programNumber || 1,
                vehicleModel: order.vehicleModel,
                baseServiceId: order.baseServiceId,
                addonServiceIds: order.addonServiceIds,
                notes: order.notes
              }
            ]);
          }
        } else {
          setCustomerId((prev) => prev || defaultCustomerId);
          setCompletedAt((prev) => prev || new Date().toISOString().slice(0, 10));
          setOrderLines((prev) => (prev.length > 0 ? prev : [createEmptyLine(defaultBaseId)]));
        }
      } catch {
        setMessage("Fehler beim Laden der Formulardaten.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [editId, isEditMode]);

  function updateLine(index: number, patch: Partial<OrderLineForm>) {
    setOrderLines((prev) => prev.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function toggleAddon(lineIndex: number, addonId: string) {
    setOrderLines((prev) =>
      prev.map((line, index) => {
        if (index !== lineIndex) return line;

        const exists = line.addonServiceIds.includes(addonId);
        return {
          ...line,
          addonServiceIds: exists
            ? line.addonServiceIds.filter((id) => id !== addonId)
            : [...line.addonServiceIds, addonId]
        };
      })
    );
  }

  function addLine() {
    setOrderLines((prev) => [...prev, createEmptyLine(baseDefaultId)]);
  }

  function insertTestDataLines() {
    if (baseServices.length === 0) {
      setMessage("Keine Basis-Services verfügbar. Testdaten konnten nicht eingefügt werden.");
      return;
    }

    const demoModels = [
      "Renault Clio",
      "Renault Captur",
      "Renault Megane",
      "Renault Talisman",
      "Renault Scenic",
      "Renault Kadjar",
      "Renault Arkana",
      "Renault Kangoo",
      "Renault Zoe",
      "Renault Austral"
    ];

    const addonIds = addonServices.map((addon) => addon.id);

    const testLines: OrderLineForm[] = Array.from({ length: 10 }, (_, index) => {
      const number = index + 1;
      const baseServiceId = baseServices[index % baseServices.length]?.id || baseDefaultId;
      const addonServiceIds = addonIds.filter((_, addonIndex) => (index + addonIndex) % 4 === 0).slice(0, 2);
      const vinSuffix = String(100000 + number).padStart(6, "0");

      return {
        vin: `WVWZZZ1JZYW${vinSuffix}`,
        licensePlate: `M-TD-${String(1000 + number)}`,
        programNumber: (index % 6) + 1,
        vehicleModel: demoModels[index % demoModels.length],
        baseServiceId,
        addonServiceIds,
        notes: `Testdatensatz ${number}`
      };
    });

    setOrderLines(testLines);
    setMessage("10 Testdaten wurden eingefügt und können sofort gespeichert werden.");
  }

  function removeLine(index: number) {
    setOrderLines((prev) => (prev.length > 1 ? prev.filter((_, lineIndex) => lineIndex !== index) : prev));
  }

  function formatAddonSummary(addonServiceIds: string[]): string {
    const selectedAddons = addonServices.filter((addon) => addonServiceIds.includes(addon.id));
    const selectedCount = selectedAddons.length;

    if (selectedCount === 0) return "Zusatzleistungen (0)";

    const shortNames = selectedAddons.map((addon) => addon.name).join(", ");
    return `Zusatzleistungen (${selectedCount}): ${shortNames}`;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!customerId) {
      setMessage("Bitte Kunde auswählen.");
      return;
    }

    if (!completedAt) {
      setMessage("Bitte Datum setzen.");
      return;
    }

    if (orderLines.length === 0) {
      setMessage("Bitte mindestens einen Posten erfassen.");
      return;
    }

    const hasInvalidLine = orderLines.some(
      (line) =>
        !line.vin.trim() ||
        !line.licensePlate.trim() ||
        !line.vehicleModel.trim() ||
        !line.baseServiceId ||
        line.programNumber < 1 ||
        line.programNumber > 6
    );

    if (hasInvalidLine) {
      setMessage("Bitte pro Posten VIN, Kennzeichen, Programm (1-6), Modell und Basis-Service ausfüllen.");
      return;
    }

    const completedAtIso = toCompletedAtIso(completedAt);

    if (isEditMode) {
      const firstLine = orderLines[0];
      const payload = {
        customerId,
        vin: firstLine.vin,
        licensePlate: firstLine.licensePlate,
        programNumber: firstLine.programNumber,
        vehicleModel: firstLine.vehicleModel,
        baseServiceId: firstLine.baseServiceId,
        addonServiceIds: firstLine.addonServiceIds,
        notes: firstLine.notes,
        status: "completed",
        completedAt: completedAtIso
      };

      const response = await fetch(`/api/orders/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Fehler beim Speichern." }));
        setMessage(err.message || "Fehler beim Speichern.");
        return;
      }

      setMessage("Auftrag aktualisiert.");
      return;
    }

    const payload = {
      customerId,
      completedAt: completedAtIso,
      orders: orderLines.map((line) => ({
        vin: line.vin,
        licensePlate: line.licensePlate,
        programNumber: line.programNumber,
        vehicleModel: line.vehicleModel,
        baseServiceId: line.baseServiceId,
        addonServiceIds: line.addonServiceIds,
        notes: line.notes
      }))
    };

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: "Fehler beim Speichern." }));
      setMessage(err.message || "Fehler beim Speichern.");
      return;
    }

    const data = await response.json().catch(() => ({}));
    const createdCount = typeof data.ordersCreated === "number" ? data.ordersCreated : orderLines.length;

    setMessage(`${createdCount} Auftrag${createdCount !== 1 ? "e" : ""} erstellt.`);
    setOrderLines([createEmptyLine(baseDefaultId)]);

    if (createdCount === 10) {
      setShowSavedModal(true);
    }
  }

  async function handleNewCustomerSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!customerForm.name || !customerForm.shortName) {
      setMessage("Bitte Name und Kurzname eingeben.");
      return;
    }

    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(customerForm)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: "Fehler beim Anlegen des Kunden." }));
      setMessage(err.message || "Fehler beim Anlegen des Kunden.");
      return;
    }

    const data = await response.json();
    const createdCustomer = data.customer as Customer;

    setCustomers((prev) => [...prev, createdCustomer]);
    setCustomerId(createdCustomer.id);
    setCustomerForm(initialCustomerForm);
    setShowNewCustomerForm(false);
    setMessage(`Kunde "${createdCustomer.name}" erfolgreich angelegt.`);
  }

  return (
    <main className="container grid page-stack">
      <div className="page-header">
        <h1>{isEditMode ? "Auftrag bearbeiten" : "Aufträge erfassen"}</h1>
        <nav className="header-nav" aria-label="Hauptnavigation">
          <Link href="/" className="header-tab header-tab-active">
            Aufträge
          </Link>
          <Link href="/invoices" className="header-tab">
            Rechnungen
          </Link>
        </nav>
      </div>

      {message ? (
        <section className="card">
          <p style={{ margin: 0 }}>{message}</p>
        </section>
      ) : null}

      <section className="card">
        {isLoading ? (
          <p>Lade Formulardaten ...</p>
        ) : (
          <>
            <div
              style={{
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12
              }}
            >
              <button
                type="button"
                className="secondary"
                onClick={() => setShowNewCustomerForm((prev) => !prev)}
                style={{ fontSize: "14px" }}
              >
                {showNewCustomerForm ? "− Kundenanlage schließen" : "+ Neuen Kunden anlegen"}
              </button>

              {!isEditMode ? (
                <button type="button" className="button-blue" onClick={insertTestDataLines}>
                  Testdaten einfügen
                </button>
              ) : null}
            </div>

            {showNewCustomerForm ? (
              <form onSubmit={handleNewCustomerSubmit} className="grid" style={{ gap: 12, marginBottom: 20 }}>
                <label>
                  Firmenname *
                  <input
                    type="text"
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="BMW Niederlassung München"
                    required
                  />
                </label>
                <label>
                  Kurzname *
                  <input
                    type="text"
                    value={customerForm.shortName}
                    onChange={(e) => setCustomerForm((prev) => ({ ...prev, shortName: e.target.value }))}
                    placeholder="BMW München"
                    required
                  />
                </label>
                <label>
                  E-Mail
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="rechnung@beispiel.de"
                  />
                </label>
                <label>
                  Telefon
                  <input
                    type="tel"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+49 89 1234567"
                  />
                </label>
                <div className="actions">
                  <button type="submit">Kunde anlegen</button>
                </div>
              </form>
            ) : null}

            <form onSubmit={handleSubmit} className="grid" style={{ gap: 12 }}>
              <label>
                Kunde *
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                  <option value="">Bitte wählen...</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Datum
                <input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} required />
              </label>

              <div className="table-wrap order-lines-wrap">
                <table className="order-lines-table">
                  <thead>
                    <tr>
                      <th>Pos</th>
                      <th>Prog</th>
                      <th>VIN</th>
                      <th>Kennzeichen</th>
                      <th>Modell</th>
                      <th>Basis-Service</th>
                      <th>Zusatzleistungen</th>
                      <th>Notizen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderLines.map((line, index) => (
                      <tr key={index}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <span>{index + 1}</span>
                          {!isEditMode ? (
                            <button
                              type="button"
                              className="order-line-inline-remove"
                              onClick={() => removeLine(index)}
                              disabled={orderLines.length <= 1}
                              aria-label="Posten löschen"
                              title="Posten löschen"
                            >
                              ×
                            </button>
                          ) : null}
                        </td>
                        <td>
                          <select
                            value={line.programNumber}
                            onChange={(e) => updateLine(index, { programNumber: Number(e.target.value) })}
                            required
                          >
                            {[1, 2, 3, 4, 5, 6].map((program) => (
                              <option key={program} value={program}>
                                {program}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={line.vin}
                            onChange={(e) => updateLine(index, { vin: e.target.value })}
                            placeholder="WVWZZZ1JZXW000001"
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={line.licensePlate}
                            onChange={(e) => updateLine(index, { licensePlate: e.target.value })}
                            placeholder="M-AB-1234"
                            required
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={line.vehicleModel}
                            onChange={(e) => updateLine(index, { vehicleModel: e.target.value })}
                            placeholder="BMW 320d"
                            required
                          />
                        </td>
                        <td>
                          <select
                            value={line.baseServiceId}
                            onChange={(e) => updateLine(index, { baseServiceId: e.target.value })}
                            required
                          >
                            <option value="">Bitte wählen...</option>
                            {baseServices.map((service) => (
                              <option key={service.id} value={service.id}>
                                {service.name} — {service.price.toFixed(2)} EUR
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <details className="order-line-addons">
                            <summary>{formatAddonSummary(line.addonServiceIds)}</summary>
                            <div className="order-line-addon-options">
                              {addonServices.map((addon) => (
                                <label key={addon.id} className="order-line-addon-option">
                                  <input
                                    className="order-line-addon-checkbox"
                                    type="checkbox"
                                    checked={line.addonServiceIds.includes(addon.id)}
                                    onChange={() => toggleAddon(index, addon.id)}
                                  />
                                  <span className="order-line-addon-text">
                                    {addon.name} (+{addon.price.toFixed(2)} EUR)
                                  </span>
                                </label>
                              ))}
                            </div>
                          </details>
                        </td>
                        <td>
                          <textarea
                            value={line.notes}
                            onChange={(e) => updateLine(index, { notes: e.target.value })}
                            rows={2}
                            className="order-line-notes"
                            placeholder="Besondere Wünsche oder Hinweise..."
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!isEditMode ? (
                <div className="actions order-lines-controls">
                  <button type="button" className="secondary" onClick={addLine}>
                    + Weitere Zeile
                  </button>
                </div>
              ) : null}

              <div className="actions">
                <button type="submit">
                  {isEditMode
                    ? "Änderungen speichern"
                    : `${orderLines.length} Auftrag${orderLines.length !== 1 ? "e" : ""} erstellen`}
                </button>
                <Link href="/" className="btn secondary">
                  Zurück zum Dashboard
                </Link>
              </div>
            </form>
          </>
        )}
      </section>

      {showSavedModal ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.28)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1200,
            padding: "20px"
          }}
        >
          <div className="card" style={{ maxWidth: "420px", width: "100%", textAlign: "center", margin: 0 }}>
            <h2 style={{ marginBottom: 10 }}>Gespeichert</h2>
            <p style={{ marginTop: 0, marginBottom: 18 }}>10 Aufträge wurden erfolgreich gespeichert.</p>
            <div className="actions" style={{ justifyContent: "center" }}>
              <button type="button" className="button-blue" onClick={() => setShowSavedModal(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function NewOrderPage() {
  return (
    <Suspense fallback={<main className="container"><p>Lade Formulardaten ...</p></main>}>
      <NewOrderPageContent />
    </Suspense>
  );
}








