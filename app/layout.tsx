import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auto-Anlage Dashboard",
  description: "Aufträge und Rechnungen verwalten"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
