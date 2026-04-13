# Checklist před nasazením do produkce

## 1. Build a lint

- [ ] `npm run build` – bez chyb
- [ ] `npm run check` / `biome check .` – bez chyb
- [ ] Žádné `console.log` / `debugger` v produkčním kódu

## 2. Environment variables (Vercel)

| Proměnná | Popis | Produkce nastavena? |
|----------|-------|---------------------|
| `POSTGRES_URL` | Neon DB connection string | ☐ |
| `JWT_SECRET` | min. 32 znaků, náhodný řetězec | ☐ |
| `RESEND_API_KEY` | Resend API klíč | ☐ |
| `CRON_SECRET` | Autentizace cron jobu | ☐ |
| `API_KEY` | API pro data vozidel | ☐ |
| `VERCEL_PROJECT_PRODUCTION_URL` | Systémová – povolit v Vercel (vininfo.cz) | ☐ |

**Volitelné:**
- `ADMIN_SECRET` – admin endpointy
- `API_BASE_URL` – pokud se liší od výchozího

## 3. Databáze

- [ ] Tabulky vytvořené (`ensureTables` při prvním requestu)
- [ ] Tabulka `odometer_readings` existuje (pokud byla přidána)
- [ ] Migrace (pokud byly) provedeny

## 4. API a integrace

- [ ] `/api/vehicle` – API pro data vozidel vrací správná data
- [ ] Přihlášení / registrace – funkční
- [ ] E-maily (Resend) – odesílají se, odkazy fungují

## 5. Cron job

- [ ] `/api/cron/send-reminders` – běží podle schedule (denně 8:00)
- [ ] `CRON_SECRET` správně nastaven pro autorizaci

## 6. E-maily

- [ ] `getBaseUrl()` vrací produkční URL (vininfo.cz), ne preview URL
- [ ] `VERCEL_PROJECT_PRODUCTION_URL` povolená v Vercel projektu
- [ ] Odkazy v reminder e-mailech (přihlášení, Cebia, sjednat pojištění) – funkční

## 7. Affiliate odkazy (Cebia, CSOB)

- [ ] Cebia – všechny odkazy obsahují `data1` identifikátor
- [ ] CSOB – kalkulačka vozidla / kupony (eHub odkazy) – funkční; platnost kuponů `validFrom` / `validTo` odpovídá období

## 8. Frontend – manuální test

- [ ] Vyhledání VIN / TP / ORV
- [ ] Stránka detailu vozidla – data, tlačítka
- [ ] Registrace nového uživatele
- [ ] Přihlášení
- [ ] Klientská zóna – vozidla, upozornění, stav tachometru, Moje výhody
- [ ] Přidání / smazání záznamu odometru
- [ ] Odometer validace (min/max km, datum, poznámka 70 znaků)
- [ ] Mobilní zobrazení (responsivita)

## 9. SEO a meta

- [ ] `index.html` – title, meta description
- [ ] Důležité stránky – vlastní title/description (HomePage, RegisterPage, ClientZonePage)
- [ ] `sitemap.xml` – aktuální URL, doména vininfo.cz
- [ ] `robots.txt` – Sitemap URL správná

## 10. Doména a SSL

- [ ] Produkční doména (vininfo.cz) propojená s Vercel projektem
- [ ] SSL certifikát aktivní (automaticky u Vercel)

## 11. Analytika a tracking

- [ ] Google Analytics – měření ID nastavené pro produkci
- [ ] Sklik / další kampaně – správné conversion tracking

## 12. Bezpečnost

- [ ] `Secure` cookie pro JWT v produkci (`NODE_ENV === 'production'`)
- [ ] Admin/CRON endpointy chráněné tajným klíčem
- [ ] Žádné API klíče / secrets v kódu (jen env variables)

## 13. Po nasazení

- [ ] Smoke test: návštěva homepage, vyhledání VIN
- [ ] Ověření e-mailu – registrace nebo test reminder
- [ ] Kontrola logů ve Vercel Dashboard (bez 500 chyb)

---

## Rychlý pre-deploy příkaz

```bash
npm run build && npm run check
```

## Připomenutí

- **Preview deploy** (`git push` do feature branche) nasadí na preview URL – e-maily mohou obsahovat preview odkazy, pokud `VERCEL_PROJECT_PRODUCTION_URL` není nastavená
- **Produkce** – jen z `main` (nebo nastavené production branch)
