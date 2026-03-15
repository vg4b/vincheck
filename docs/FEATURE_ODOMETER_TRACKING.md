# Analýza a plán: Stav tachometru a sledování trendů

## 1. Shrnutí feature

Umožnit uživatelům v klientské zóně (Moje VINInfo) přidávat záznamy o stavu tachometru u jednotlivých vozidel a zobrazovat trend (graf) vývoje najetých kilometrů v čase.

**Uživatelská hodnota:**
- Evidence stavu km pro vlastní záznamy (servis, prodej, leasing)
- Detekce anomálií (např. neočekávaný pokles = podezření na svinutí)
- Přehled ročního nájezdu (pro plánování servisu, pojištění)
- Dlouhodobá historie vozidla

---

## 2. Analýza současného stavu

### 2.1 Databáze
- **vehicles** – vozidla uživatele (id, user_id, vin, tp, orv, title, brand, model, snapshot)
- **reminders** – upozornění na termíny (vehicle_id, type, due_date, …)
- Registr vozidel **neobsahuje** historii tachometru – data budou pouze z manuálního vstupu uživatele

### 2.2 Klientská zóna
- **Taby:** Moje vozidla, Moje upozornění, Moje výhody, Nastavení
- **Karta vozidla:** název, VIN/TP/ORV, STK do, odkazy, upozornění, formulář pro nové upozornění
- **API:** `/api/client/vehicles`, `/api/client/reminders`

### 2.3 Stack
- React, Bootstrap, TypeScript
- Vercel Postgres
- Žádná knihovna pro grafy (bude potřeba přidat)

---

## 3. Návrh datového modelu

### 3.1 Nová tabulka `odometer_readings`

```sql
CREATE TABLE odometer_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  recorded_at date NOT NULL,
  km integer NOT NULL CHECK (km >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX odometer_readings_vehicle_idx ON odometer_readings(vehicle_id);
CREATE INDEX odometer_readings_vehicle_date_idx ON odometer_readings(vehicle_id, recorded_at);
```

**Pole:**
| Pole        | Typ    | Popis                                      |
|-------------|--------|--------------------------------------------|
| id          | uuid   | PK                                         |
| user_id     | uuid   | FK na users (bezpečnost)                    |
| vehicle_id  | uuid   | FK na vehicles                              |
| recorded_at | date   | Datum měření (např. při tankování, STK)    |
| km          | integer| Stav tachometru v km                       |
| note        | text   | Volitelná poznámka (max 70 znaků)          |
| created_at  | timestamptz | Kdy byl záznam vytvořen               |

**Validace:**
- `km >= 0`
- `recorded_at` – platné datum (ne v budoucnosti?)
- Volitelně: nový km >= poslední záznam pro dané vozidlo (varování při poklesu)

---

## 4. API návrh

### 4.1 Endpoint `/api/client/odometer-readings`

**GET** – seznam záznamů
- Query: `vehicleId` (povinné) – filtrovat podle vozidla
- Response: `{ readings: OdometerReading[] }`
- Řazení: `recorded_at DESC`

**POST** – přidat záznam
- Body: `{ vehicleId, recordedAt, km, note? }`
- Validace: vehicle patří userovi, km >= 0
- Response: `{ reading: OdometerReading }`

**PATCH** – upravit záznam
- Body: `{ id, recordedAt?, km?, note? }`
- Response: `{ reading: OdometerReading }`

**DELETE** – smazat záznam
- Query: `id`
- Response: `{ success: true }`

### 4.2 TypeScript typ

```ts
export interface OdometerReading {
  id: string
  vehicle_id: string
  recorded_at: string  // ISO date
  km: number
  note?: string | null
  created_at?: string
}
```

---

## 5. UI návrh

### 5.1 Umístění v klientské zóně

**Moje vozidla** – rozšíření karty vozidla:
- Nová sekce „Stav tachometru“ pod sekcí „Upozornění“
- Tlačítko „Přidat stav km“
- Tabulka posledních záznamů (datum, km, poznámka)
- Odkaz „Zobrazit trend“ → rozbalení nebo modal s grafem

### 5.2 Formulář pro přidání záznamu

- **Datum** – date input (výchozí: dnes)
- **Stav (km)** – number input, min 0
- **Poznámka** – volitelný text (např. „před STK“, „tankování“)
- Validace: km >= 0, datum ne v budoucnosti

### 5.3 Graf trendu

- **Osa X:** datum
- **Osa Y:** km
- Bodový / liniový graf
- Zobrazení průměrného denního/ročního nájezdu (volitelně)
- Možnost upozornění při poklesu km mezi záznamy

### 5.4 Prázdný stav

- „Zatím nemáte žádné záznamy o stavu tachometru. Přidejte první měření.“
- CTA: „Přidat stav km“

---

## 6. Technický plán implementace

### Fáze 1: Backend (API + DB)
1. Přidat migraci tabulky `odometer_readings` do `api/_db.ts`
2. Vytvořit `api/client/odometer-readings.ts` – GET, POST, PATCH, DELETE
3. Přidat typ `OdometerReading` do `src/types/index.ts`
4. Přidat funkce do `src/utils/clientZoneApi.ts` (fetch, create, update, delete)

### Fáze 2: UI – základní CRUD
5. Komponenta `OdometerForm` – formulář pro přidání záznamu
6. Komponenta `OdometerList` – tabulka záznamů u vozidla
7. Integrace do `ClientZonePage` – sekce v kartě vozidla
8. Handler pro přidání/úpravu/smazání

### Fáze 3: Graf trendů
9. Přidat knihovnu pro grafy (např. `recharts` – populární, React-friendly)
10. Komponenta `OdometerChart` – liniový graf km vs. datum
11. Zobrazení grafu v kartě vozidla (rozbalení / modal / nový tab)

### Fáze 4: Vylepšení (volitelné)
12. Validace: varování při poklesu km
13. Výpočet průměrného ročního nájezdu
14. Export dat (CSV)
15. SEO: zmínka v popisu Moje VINInfo („sledování stavu tachometru“)

---

## 7. Volby a doporučení

### 7.1 Knihovna pro grafy
- **Recharts** – doporučeno: React-first, jednoduché API, malá velikost, bez závislosti na jQuery
- Alternativa: Chart.js + react-chartjs-2

### 7.2 Datum v budoucnosti
- Povolit nebo zakázat? Doporučení: **povolit** – uživatel může zadat datum měření zpětně (např. po STK)

### 7.3 Pokles km
- **Varování** (ne blokování) při `km < poslední záznam` – může jít o překlep nebo skutečné svinutí
- Zobrazit v UI: „Pozor: nový stav je nižší než předchozí záznam.“

### 7.4 Limit záznamů
- Doporučení: neomezeno, ale v UI zobrazit např. posledních 20–50; „Zobrazit více“ pro starší

---

## 8. Odhad náročnosti

| Fáze              | Čas (odhad) |
|-------------------|-------------|
| Fáze 1: Backend   | 2–3 h       |
| Fáze 2: UI CRUD   | 2–3 h       |
| Fáze 3: Graf      | 1–2 h       |
| Fáze 4: Vylepšení | 1–2 h       |
| **Celkem**        | **6–10 h**  |

---

## 9. Rizika a mitigace

| Riziko                    | Mitigace                                      |
|---------------------------|-----------------------------------------------|
| Špatná validace km        | CHECK constraint v DB, validace na API i UI   |
| Duplicitní záznamy        | Umožnit více záznamů za den (různé časy)      |
| Velký objem dat           | Index na (vehicle_id, recorded_at), paginace  |
| Mobilní zobrazení grafu   | Responzivní Recharts, scroll horizontálně     |

---

## 10. Nasazení / SQL

**Není potřeba spouštět SQL ručně.** Tabulka `odometer_readings` se vytvoří automaticky při prvním volání libovolného API endpointu, který volá `ensureTables()` (např. `/api/client/vehicles` nebo `/api/client/odometer-readings`). Migrace běží v rámci `api/_db.ts`.

V případě potřeby manuální migrace lze spustit lokálně:

```sql
CREATE TABLE IF NOT EXISTS odometer_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  recorded_at date NOT NULL,
  km integer NOT NULL CHECK (km >= 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS odometer_readings_vehicle_idx ON odometer_readings(vehicle_id);
CREATE INDEX IF NOT EXISTS odometer_readings_vehicle_date_idx ON odometer_readings(vehicle_id, recorded_at);
```

---

## 11. Související dokumentace

- `docs/CLIENT_ZONE.md` – struktura klientské zóny
- `docs/API.md` – přehled API
- `api/_db.ts` – schéma databáze
