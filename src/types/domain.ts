export type OrderStatus = "new" | "completed";
export type InvoiceStatus = "open" | "paid";
export type ProgramNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type ServiceItem = {
  id: string;
  name: string;
  price: number;
};

export type Customer = {
  id: string;
  name: string;
  shortName?: string;
  address?: string;
  email?: string;
  phone?: string;
  createdAt: string;
};

export type CompanyProfile = {
  name: string;
  address?: string;
  email?: string;
  phone?: string;
};

export type Order = {
  id: string;
  customerId: string;
  vin: string;
  licensePlate: string;
  programNumber: ProgramNumber;
  vehicleModel: string;
  baseServiceId: string;
  addonServiceIds: string[];
  notes: string;
  status: OrderStatus;
  createdAt: string;
  completedAt?: string;
  invoiceId?: string;
};

export type InvoiceLineItem = {
  position: number;
  orderId: string;
  programNumber: ProgramNumber;
  programLabel: string;
  vin: string;
  licensePlate: string;
  unitNet: number;
  extrasNet: number;
  totalNet: number;
  extrasLabels: string[];
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  issuer: CompanyProfile;
  customerId: string;
  customerName: string;
  orderIds: string[];
  lineItems: InvoiceLineItem[];
  subtotalNet: number;
  taxRate: number;
  taxAmount: number;
  totalGross: number;
  subtotal: number;
  total: number;
  status: InvoiceStatus;
  createdAt: string;
  paidAt?: string;
};

export type Database = {
  companyProfile: CompanyProfile;
  customers: Customer[];
  orders: Order[];
  invoices: Invoice[];
};
