import { ServiceItem } from "@/types/domain";

export const baseServices: ServiceItem[] = [
  { id: "basic", name: "Innen- & Außenreinigung", price: 79 },
  { id: "premium", name: "Premium-Aufbereitung", price: 149 },
  { id: "showroom", name: "Showroom-Komplettpaket", price: 249 }
];

export const addonServices: ServiceItem[] = [
  { id: "polish", name: "Lackpolitur", price: 59 },
  { id: "ozone", name: "Ozonbehandlung", price: 39 },
  { id: "engine", name: "Motorraumreinigung", price: 49 },
  { id: "seal", name: "Versiegelung", price: 89 }
];

export const allServices = [...baseServices, ...addonServices];
