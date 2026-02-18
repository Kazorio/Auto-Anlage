import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { allServices } from "@/data/catalog";
import { Customer, Database, Invoice, InvoiceLineItem, Order } from "@/types/domain";

const defaultDb: Database = { customers: [], orders: [], invoices: [] };
const dbFilePath = process.env.DATA_FILE_PATH || path.join(process.cwd(), "data", "db.json");

let writeQueue = Promise.resolve();

async function ensureDbFile(): Promise<void> {
  const dir = path.dirname(dbFilePath);
  await mkdir(dir, { recursive: true });
  try {
    await readFile(dbFilePath, "utf-8");
  } catch {
    await writeFile(dbFilePath, JSON.stringify(defaultDb, null, 2), "utf-8");
  }
}

export async function readDb(): Promise<Database> {
  await ensureDbFile();
  const raw = await readFile(dbFilePath, "utf-8");
  try {
    return JSON.parse(raw) as Database;
  } catch {
    return defaultDb;
  }
}

async function writeDb(db: Database): Promise<void> {
  await ensureDbFile();
  const tempPath = `${dbFilePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(db, null, 2), "utf-8");
  await rename(tempPath, dbFilePath);
}

export async function mutateDb(mutator: (db: Database) => Database | Promise<Database>): Promise<Database> {
  writeQueue = writeQueue.then(async () => {
    const current = await readDb();
    const updated = await mutator(current);
    await writeDb(updated);
  });
  await writeQueue;
  return readDb();
}

export function createCustomerId(): string {
  return `cust_${randomUUID()}`;
}

export function createOrderId(): string {
  return `ord_${randomUUID()}`;
}

export function createInvoiceId(): string {
  return `inv_${randomUUID()}`;
}

export function createInvoiceNumber(existingCount: number): string {
  const now = new Date();
  return `RE-${now.getFullYear()}-${String(existingCount + 1).padStart(5, "0")}`;
}

export function getServiceLabel(serviceId: string): string {
  return allServices.find((service) => service.id === serviceId)?.name ?? serviceId;
}

export function getServicePrice(serviceId: string): number {
  return allServices.find((service) => service.id === serviceId)?.price ?? 0;
}

// NEU: Erstellt Rechnung aus mehreren Orders
export function buildInvoiceFromOrders(
  orders: Order[],
  customer: Customer,
  existingInvoicesCount: number
): Invoice {
  const lineItems: InvoiceLineItem[] = [];

  // Für jeden Order: Line Items mit Fahrzeug-Zuordnung
  for (const order of orders) {
    const baseItem: InvoiceLineItem = {
      orderId: order.id,
      licensePlate: order.licensePlate,
      vehicleModel: order.vehicleModel,
      label: getServiceLabel(order.baseServiceId),
      price: getServicePrice(order.baseServiceId)
    };
    lineItems.push(baseItem);

    for (const addonId of order.addonServiceIds) {
      const addonItem: InvoiceLineItem = {
        orderId: order.id,
        licensePlate: order.licensePlate,
        vehicleModel: order.vehicleModel,
        label: getServiceLabel(addonId),
        price: getServicePrice(addonId)
      };
      lineItems.push(addonItem);
    }
  }

  const subtotal = lineItems.reduce((sum, item) => sum + item.price, 0);

  return {
    id: createInvoiceId(),
    invoiceNumber: createInvoiceNumber(existingInvoicesCount),
    customerId: customer.id,
    customerName: customer.name,
    orderIds: orders.map((o) => o.id),
    lineItems,
    subtotal,
    total: subtotal,
    status: "open",
    createdAt: new Date().toISOString()
  };
}

// NEU: Findet nicht abgerechnete completed Orders für Wochenabrechnung
export function findOrdersForWeeklyInvoicing(
  db: Database,
  customerId: string,
  weekStart: string,
  weekEnd: string
): Order[] {
  const startDate = new Date(weekStart);
  const endDate = new Date(weekEnd);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);

  const startTs = startDate.getTime();
  const endTs = endDate.getTime();

  return db.orders.filter((order) => {
    if (
      order.customerId !== customerId ||
      order.status !== "completed" ||
      order.invoiceId ||
      !order.completedAt
    ) {
      return false;
    }

    const completedTs = new Date(order.completedAt).getTime();
    if (Number.isNaN(completedTs)) {
      return false;
    }

    return completedTs >= startTs && completedTs <= endTs;
  });
}

// NEU: Erstellt wöchentliche Sammelrechnungen für ausgewählte Kunden
export async function createWeeklyInvoices(
  customerIds: string[],
  weekStart: string,
  weekEnd: string
): Promise<{ invoices: Invoice[]; skippedCustomers: string[] }> {
  const createdInvoiceIds: string[] = [];
  const skippedCustomers: string[] = [];

  const updatedDb = await mutateDb(async (db) => {
    for (const customerId of customerIds) {
      const customer = db.customers.find((c) => c.id === customerId);
      if (!customer) {
        skippedCustomers.push(customerId);
        continue;
      }

      const orders = findOrdersForWeeklyInvoicing(db, customerId, weekStart, weekEnd);
      if (orders.length === 0) {
        skippedCustomers.push(customerId);
        continue;
      }

      const invoice = buildInvoiceFromOrders(orders, customer, db.invoices.length);
      createdInvoiceIds.push(invoice.id);

      for (const order of orders) {
        const orderIndex = db.orders.findIndex((o) => o.id === order.id);
        if (orderIndex !== -1) {
          db.orders[orderIndex].invoiceId = invoice.id;
        }
      }

      db.invoices.push(invoice);
    }

    return db;
  });

  return {
    invoices: updatedDb.invoices.filter((invoice) => createdInvoiceIds.includes(invoice.id)),
    skippedCustomers
  };
}

// DEPRECATED: Alte Einzelrechnung-Funktion (für Backwards-Kompatibilität)
export function buildInvoiceFromOrder(order: Order, customerName: string, existingInvoicesCount: number): Invoice {
  const lineItems: InvoiceLineItem[] = [
    {
      orderId: order.id,
      licensePlate: order.licensePlate,
      vehicleModel: order.vehicleModel,
      label: getServiceLabel(order.baseServiceId),
      price: getServicePrice(order.baseServiceId)
    },
    ...order.addonServiceIds.map((addonId) => ({
      orderId: order.id,
      licensePlate: order.licensePlate,
      vehicleModel: order.vehicleModel,
      label: getServiceLabel(addonId),
      price: getServicePrice(addonId)
    }))
  ];

  const subtotal = lineItems.reduce((sum, item) => sum + item.price, 0);

  return {
    id: createInvoiceId(),
    invoiceNumber: createInvoiceNumber(existingInvoicesCount),
    customerId: order.customerId,
    customerName,
    orderIds: [order.id],
    lineItems,
    subtotal,
    total: subtotal,
    status: "open",
    createdAt: new Date().toISOString()
  };
}

