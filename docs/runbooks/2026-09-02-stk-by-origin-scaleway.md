# Runbook: STK podle původu (DE × tuzemské) – noční Scaleway migrace + přepočet

**Cíl:** aplikovat migraci `013_stk_by_origin.sql`, přepočítat `stats_model`
upravenou `compute-stats.sql`, ověřit rozpad napříč modely, a teprve pak mergnout
čtecí cestu na main.

**Kdy:** v noci, jedním během (nejlíp spolu s běžným měsíčním přepočtem –
plný běh je ~2 h a `TRUNCATE`uje `stats_model`, takže půlku dne nepublikovat).

**Kód:** vše na větvi `feat/stk-by-origin` (migrace, `compute-stats.sql`, API,
dlaždice). Na `main` je zatím jen rollout modulu (R1/R2/R3), který nové sloupce
nečte – proto je `main` bezpečný i před migrací.

---

## 0. Předpoklady

```bash
cd ~/repos/vincheck
git checkout feat/stk-by-origin && git pull

# Admin connection string (NE read-only vincheck_api). Čte se z .env, nikam se
# netiskne. Ověř, že je nastaven:
[ -n "${DATABASE_URL:-}" ] || grep -q '^DATABASE_URL=' .env && echo "DATABASE_URL OK" || echo "CHYBÍ DATABASE_URL"
```

Keepalives proti tichému padnutí idle spojení (vzor z `backfill-defects.sh`):

```bash
PSQL_URL="${DATABASE_URL}$(case "$DATABASE_URL" in *\?*) echo '&';; *) echo '?';; esac)keepalives=1&keepalives_idle=15"
```

## 1. Migrace 013 (aditivní, sekundy)

Bezpečná: jen `ADD COLUMN IF NOT EXISTS`, sloupce nullable, žádný default,
žádný zámek nad daty. Nezpomalí a nerozbije nic, co běží.

```bash
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/013_stk_by_origin.sql

# Kontrola, že sloupce existují (a jsou NULL – naplní je až přepočet):
psql "$PSQL_URL" -qtAX -c "
  SELECT column_name FROM information_schema.columns
  WHERE table_name='stats_model' AND column_name LIKE 'stk_%_de'
     OR (table_name='stats_model' AND column_name LIKE 'stk_%_domestic')
  ORDER BY 1;"
# Očekávej: stk_fail_pct_de, stk_fail_pct_domestic, stk_inspections_de, stk_inspections_domestic
```

## 2. Přepočet (`compute-stats.sql`, ~2 h)

`TRUNCATE stats_model` + plný rebuild. `min_count=500` je produkční publikační
práh (default, zvýšen ze 100 dne 2026-08-20 – NE 100, to je jen fixture).
`caffeinate -i` ať Mac neusne uprostřed.

```bash
caffeinate -i psql "$PSQL_URL" -v ON_ERROR_STOP=1 -v min_count=500 \
  -f scripts/compute-stats.sql
```

Nové sloupce stojí jen dva hash buildy nad `vehicle_imports` (~3,4M řádků),
znovupoužité pro celý běh – přidány všechny 4 najednou, žádné iterování po
sloupci. Když se běh protáhne o víc než pár minut proti běžnému času, je to
regrese k prozkoumání (DoD).

## 3. Ověření napříč modely (na prod datech)

Research čísla k reprodukci (DE vs. tuzemské, bez záznamu dovozu):

| model | tuzemské | z Německa | rozdíl |
|---|---|---|---|
| VW Golf | 2,69 % | 3,82 % | +42 % |
| Audi A4 | 2,74 % | 3,28 % | +20 % |
| VW Passat | 3,62 % | 4,34 % | +20 % |
| Ford Focus | 4,61 % | 5,42 % | +18 % |
| Škoda Fabia | 3,24 % | 3,78 % | +17 % |

```bash
psql "$PSQL_URL" -X -c "
  SELECT brand, model,
         stk_fail_pct_domestic AS dom, stk_inspections_domestic AS dom_n,
         stk_fail_pct_de        AS de,  stk_inspections_de        AS de_n,
         round(100.0*(stk_fail_pct_de - stk_fail_pct_domestic)
               / nullif(stk_fail_pct_domestic,0)) AS rel_pct
  FROM stats_model
  WHERE (brand ILIKE 'VOLKSWAGEN' AND model IN ('GOLF','PASSAT'))
     OR (brand ILIKE 'AUDI'  AND model='A4')
     OR (brand ILIKE 'FORD'  AND model='FOCUS')
     OR (brand ILIKE 'ŠKODA' AND model='FABIA')
  ORDER BY brand, model;"
```

Kontroly:
- **Směr:** `de > dom` u všech pěti (research to drží bez výjimky).
- **Řád:** čísla řádově sedí k tabulce (přesná shoda se nečeká – přepočet je nad
  aktuálním parkem, research byl starší řez).
- **Denominátory nejsou rozklad celku:** `de_n + dom_n < stk_inspections`
  (rozdíl = dovoz z jiných zemí, který je v žádném kbelíku). Ověř:

```bash
psql "$PSQL_URL" -X -c "
  SELECT count(*) AS models_kde_de_vetsi
  FROM stats_model
  WHERE stk_inspections_de >= 500 AND stk_inspections_domestic >= 500
    AND stk_fail_pct_de > stk_fail_pct_domestic;
  -- vs. opačný směr (má být výrazně menší):
  SELECT count(*) AS models_kde_de_mensi
  FROM stats_model
  WHERE stk_inspections_de >= 500 AND stk_inspections_domestic >= 500
    AND stk_fail_pct_de < stk_fail_pct_domestic;"
```

## 4. Merge čtecí cesty a ověření na prod

Až rozpad na prod sedí:

```bash
git checkout main && git pull
git merge --no-ff feat/stk-by-origin
git push origin main   # Vercel nasadí čtecí cestu (API + dlaždice)
```

Prod smoke test (dlaždice se ukáže jen když oba kbelíky ≥ 500 prohlídek):

```bash
curl -s "https://www.vininfo.cz/api/stats?type=model&brand=skoda&model=fabia" \
  | python3 -c "import sys,json; d=json.load(sys.stdin)['stats']; \
      print('de',d['stkFailPctDe'],'dom',d['stkFailPctDomestic'])"
```

A vizuálně: `https://www.vininfo.cz/znacky/skoda/fabia` → sekce „Poruchovost při
STK" má větu „Dovezené z Německa propadají na STK o X % častěji než tuzemské".

## Rollback

- **Sloupce** (013): neškodí – prázdné/nečtené. Není nutné rušit. Kdyby ano:
  `ALTER TABLE stats_model DROP COLUMN stk_fail_pct_de, ...`.
- **Špatná čísla po přepočtu:** znovu spustit `compute-stats.sql` (idempotentní,
  `TRUNCATE`+rebuild) po opravě SQL. Čtecí cesta na main mergnout až po nápravě.
- **Dlaždice na main a čísla ještě nejsou:** dlaždice je NULL-safe, sama se
  nevykreslí – žádný vizuální rozbití, jen chybí věta.
