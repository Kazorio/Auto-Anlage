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

## Dokploy Deployment
Ja, für Dokploy nutzt du am besten ein `Dockerfile` (ist jetzt enthalten).

Empfohlene Einstellungen in Dokploy:
- **Build Type**: Dockerfile
- **Port**: `3000`
- **Env**:
  - `NODE_ENV=production`
  - `DATA_FILE_PATH=/app/data/db.json`
- **Persistent Volume**: auf `/app/data` mounten

Warum Volume: Die App speichert Daten in JSON. Ohne Volume wären Daten nach Redeploy/Container-Neustart weg.

Optional lokal testen:
1. `docker build -t auto-anlage .`
2. `docker run -p 3000:3000 -e DATA_FILE_PATH=/app/data/db.json auto-anlage`

## Wichtige Grenzen des MVP
- Keine Benutzerverwaltung/Login
- JSON-Datei ist für Demo/kleinen Single-Instance-Betrieb gedacht
- Bei mehreren Instanzen ist später eine echte Datenbank notwendig
