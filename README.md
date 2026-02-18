# Auto-Anlage MVP (Next.js + TypeScript)

Dieses MVP ersetzt Papier + Excel durch eine einfache Weboberfläche ohne Login.

## Funktionen
- Auftrag auf separater Seite erfassen und bearbeiten
- Kennzeichen, Kunde, Modell, Basisleistung, Zusatzleistungen, Notiz
- Dashboard: nicht abgerechnet, offen, bezahlt, Summen
- Rechnung aus Auftrag erstellen und im System speichern
- Rechnungsbereich mit Status offen/bezahlt
- Druckansicht und PDF-Download je Rechnung

## Start lokal
1. `npm install`
2. `.env.example` nach `.env.local` kopieren (optional)
3. `npm run dev`
4. `http://localhost:3000`

## JSON-Datenhaltung
- Standardpfad: `./data/db.json`
- Anpassbar über `DATA_FILE_PATH`

## Dokploy Hinweis
Für persistente Daten ein Volume mounten und `DATA_FILE_PATH` auf den gemounteten Pfad setzen, z. B. `/app/data/db.json`.

## Wichtige Grenzen des MVP
- Keine Benutzerverwaltung/Login
- JSON-Datei ist für Demo/kleinen Single-Instance-Betrieb gedacht
- Bei mehreren Instanzen ist später eine echte Datenbank notwendig
