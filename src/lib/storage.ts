import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { allServices } from "@/data/catalog";
import {
  CompanyProfile,
  Customer,
  Database,
  Invoice,
  InvoiceLineItem,
  Order,
  ProgramNumber
} from "@/types/domain";

const VAT_RATE = 0.19;
const defaultCompanyProfile: CompanyProfile = {
  name: "Auto-Anlage GmbH",
  address: "Musterstraße 1, 80331 München",
  email: "rechnung@auto-anlage.de",
  phone: "+49 89 000000"
};
const defaultDb: Database = { companyProfile: defaultCompanyProfile, customers: [], orders: [], invoices: [] };
const dbFilePath = process.env.DATA_FILE_PATH || path.join(process.cwd(), "data", "db.json");

let writeQueue = Promise.resolve();

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function toProgramNumber(value: unknown): ProgramNumber {
  const asNumber = Number(value);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 6) {
    return asNumber as ProgramNumber;
  }
  return 1;
}

function inferProgramNumber(baseServiceId: string): ProgramNumber {
  if (baseServiceId === "basic") return 1;
  if (baseServiceId === "premium") return 2;
  if (baseServiceId === "showroom") return 3;
  return 1;
}

function normalizeCompanyProfile(value: unknown): CompanyProfile {
  if (!value || typeof value !== "object") {
    return defaultCompanyProfile;
  }

  const source = value as Partial<CompanyProfile>;
  return {
    name: String(source.name || defaultCompanyProfile.name),
    address: source.address ? String(source.address) : defaultCompanyProfile.address,
    email: source.email ? String(source.email) : defaultCompanyProfile.email,
    phone: source.phone ? String(source.phone) : defaultCompanyProfile.phone
  };
}

function normalizeOrder(value: unknown): Order {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Order>;
  const baseServiceId = String(source.baseServiceId || "");
  return {
    id: String(source.id || createOrderId()),
    customerId: String(source.customerId || ""),
    vin: String(source.vin || "").toUpperCase(),
    licensePlate: String(source.licensePlate || "").toUpperCase(),
    programNumber: toProgramNumber(source.programNumber ?? inferProgramNumber(baseServiceId)),
    vehicleModel: String(source.vehicleModel || ""),
    baseServiceId,
    addonServiceIds: Array.isArray(source.addonServiceIds) ? source.addonServiceIds.map(String) : [],
    notes: source.notes ? String(source.notes) : "",
    status: source.status === "new" ? "new" : "completed",
    createdAt: source.createdAt ? String(source.createdAt) : new Date().toISOString(),
    completedAt: source.completedAt ? String(source.completedAt) : undefined,
    invoiceId: source.invoiceId ? String(source.invoiceId) : undefined
  };
}

function buildInvoiceLineItems(orders: Order[]): InvoiceLineItem[] {
  return orders.map((order, index) => {
    const unitNet = getServicePrice(order.baseServiceId);
    const extrasNet = order.addonServiceIds.reduce((sum, addonId) => sum + getServicePrice(addonId), 0);
    return {
      position: index + 1,
      orderId: order.id,
      programNumber: order.programNumber,
      programLabel: getServiceLabel(order.baseServiceId),
      vin: order.vin,
      licensePlate: order.licensePlate,
      unitNet: roundCurrency(unitNet),
      extrasNet: roundCurrency(extrasNet),
      totalNet: roundCurrency(unitNet + extrasNet),
      extrasLabels: order.addonServiceIds.map(getServiceLabel)
    };
  });
}

function normalizeInvoice(value: unknown, db: Database, index: number): Invoice {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Invoice> & {
    lineItems?: Array<
      Partial<InvoiceLineItem> & {
        label?: string;
        price?: number;
      }
    >;
  };

  const orderIds = Array.isArray(source.orderIds) ? source.orderIds.map(String) : [];
  const ordersById = new Map(db.orders.map((order) => [order.id, order]));
  const linkedOrders = orderIds.map((id) => ordersById.get(id)).filter((order): order is Order => Boolean(order));

  const hasNewFormat = Array.isArray(source.lineItems) && source.lineItems.every((item) => typeof item.totalNet === "number");
  const lineItems: InvoiceLineItem[] = hasNewFormat
    ? source.lineItems!.map((item, itemIndex) => {
        const programNumber = toProgramNumber(item.programNumber);
        const unitNet = roundCurrency(Number(item.unitNet ?? 0));
        const extrasNet = roundCurrency(Number(item.extrasNet ?? 0));
        const totalNet = roundCurrency(Number(item.totalNet ?? unitNet + extrasNet));
        return {
          position: Number(item.position ?? itemIndex + 1),
          orderId: String(item.orderId || linkedOrders[itemIndex]?.id || ""),
          programNumber,
          programLabel: String(item.programLabel || linkedOrders[itemIndex]?.baseServiceId || ""),
          vin: String(item.vin || linkedOrders[itemIndex]?.vin || ""),
          licensePlate: String(item.licensePlate || linkedOrders[itemIndex]?.licensePlate || ""),
          unitNet,
          extrasNet,
          totalNet,
          extrasLabels: Array.isArray(item.extrasLabels) ? item.extrasLabels.map(String) : []
        };
      })
    : buildInvoiceLineItems(linkedOrders);

  const subtotalNet = roundCurrency(
    typeof source.subtotalNet === "number"
      ? source.subtotalNet
      : typeof source.subtotal === "number"
        ? source.subtotal
        : lineItems.reduce((sum, item) => sum + item.totalNet, 0)
  );
  const taxRate = typeof source.taxRate === "number" ? source.taxRate : VAT_RATE;
  const taxAmount = roundCurrency(
    typeof source.taxAmount === "number" ? source.taxAmount : subtotalNet * taxRate
  );
  const totalGross = roundCurrency(
    typeof source.totalGross === "number"
      ? source.totalGross
      : typeof source.total === "number"
        ? source.total
        : subtotalNet + taxAmount
  );

  const customer = db.customers.find((item) => item.id === source.customerId);

  return {
    id: String(source.id || createInvoiceId()),
    invoiceNumber: String(source.invoiceNumber || createInvoiceNumber(index)),
    issuer: normalizeCompanyProfile(source.issuer ?? db.companyProfile),
    customerId: String(source.customerId || customer?.id || ""),
    customerName: String(source.customerName || customer?.name || "Unbekannt"),
    orderIds,
    lineItems,
    subtotalNet,
    taxRate,
    taxAmount,
    totalGross,
    subtotal: subtotalNet,
    total: totalGross,
    status: source.status === "paid" ? "paid" : "open",
    createdAt: String(source.createdAt || new Date().toISOString()),
    paidAt: source.paidAt ? String(source.paidAt) : undefined
  };
}

function normalizeDb(raw: unknown): Database {
  const source = (raw && typeof raw === "object" ? raw : {}) as Partial<Database>;
  const customers = Array.isArray(source.customers) ? source.customers : [];
  const orders = Array.isArray(source.orders) ? source.orders.map(normalizeOrder) : [];
  const dbBase: Database = {
    companyProfile: normalizeCompanyProfile(source.companyProfile),
    customers,
    orders,
    invoices: []
  };

  const invoices = Array.isArray(source.invoices)
    ? source.invoices.map((invoice, index) => normalizeInvoice(invoice, dbBase, index))
    : [];

  return { ...dbBase, invoices };
}

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
    return normalizeDb(JSON.parse(raw));
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
    const updated = normalizeDb(await mutator(current));
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

export function buildInvoiceFromOrders(
  orders: Order[],
  customer: Customer,
  existingInvoicesCount: number,
  issuer: CompanyProfile
): Invoice {
  const lineItems = buildInvoiceLineItems(orders);
  const subtotalNet = roundCurrency(lineItems.reduce((sum, item) => sum + item.totalNet, 0));
  const taxAmount = roundCurrency(subtotalNet * VAT_RATE);
  const totalGross = roundCurrency(subtotalNet + taxAmount);

  return {
    id: createInvoiceId(),
    invoiceNumber: createInvoiceNumber(existingInvoicesCount),
    issuer,
    customerId: customer.id,
    customerName: customer.name,
    orderIds: orders.map((order) => order.id),
    lineItems,
    subtotalNet,
    taxRate: VAT_RATE,
    taxAmount,
    totalGross,
    subtotal: subtotalNet,
    total: totalGross,
    status: "open",
    createdAt: new Date().toISOString()
  };
}

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

      const invoice = buildInvoiceFromOrders(orders, customer, db.invoices.length, db.companyProfile);
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

export function buildInvoiceFromOrder(
  order: Order,
  customer: Customer,
  existingInvoicesCount: number,
  issuer: CompanyProfile
): Invoice {
  return buildInvoiceFromOrders([order], customer, existingInvoicesCount, issuer);
}
