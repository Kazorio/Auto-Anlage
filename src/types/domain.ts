export type OrderStatus = "new" | "completed";
export type InvoiceStatus = "open" | "paid";

export type ServiceItem = {
  id: string;
  name: string;
  price: number;
};

// NEU: Customer = Autohaus/Hersteller (B2B-Kunde)
export type Customer = {
  id: string;
  name: string;
  shortName?: string;
  address?: string;
  email?: string;
  phone?: string;
  createdAt: string;
};

// GEÄNDERT: Order referenziert Customer statt customerName
export type Order = {
  id: string;
  customerId: string;
  licensePlate: string;
  vehicleModel: string;
  baseServiceId: string;
  addonServiceIds: string[];
  notes: string;
  status: OrderStatus;
  createdAt: string;
  completedAt?: string;
  invoiceId?: string;
};

// GEÄNDERT: InvoiceLineItem mit Fahrzeug-Zuordnung
export type InvoiceLineItem = {
  orderId?: string;
  licensePlate?: string;
  vehicleModel?: string;
  label: string;
  price: number;
};

// GEÄNDERT: Invoice kann mehrere Orders enthalten
export type Invoice = {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  orderIds: string[];
  lineItems: InvoiceLineItem[];
  subtotal: number;
  total: number;
  status: InvoiceStatus;
  createdAt: string;
  paidAt?: string;
};

// GEÄNDERT: Database mit Customers
export type Database = {
  customers: Customer[];
  orders: Order[];
  invoices: Invoice[];
};
