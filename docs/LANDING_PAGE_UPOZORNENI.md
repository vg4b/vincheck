# Návrh landing page: Upozornění na termíny vozidla

**URL:** `/upozorneni-na-terminy`  
**Cíl:** SEO pro vyhledávání „upozornění STK“, „připomínka technická kontrola“, „připomenutí pojištění vozidla“

---

## Struktura stránky

### 1. Hero sekce
- **H1:** Upozornění na termíny vozidla – STK, pojištění, servis zdarma
- **Podnadpis:** Nikdy nezmeškejte důležitý termín. Uložte si vozidlo do Moje VINInfo a nechte se emailem připomenout v termínu, který si zvolíte.
- **CTA tlačítko:** Vytvořit účet zdarma → (odkaz na /registrace)

### 2. Jak to funguje (3 kroky)
1. **Zkontrolujte vozidlo** – zadejte VIN, TP nebo ORV a ověřte údaje v registru
2. **Uložte si vozidlo** – vytvořte si účet a přidejte vozidlo do Moje VINInfo
3. **Nastavte upozornění** – vyberte typ (STK, pojištění, servis…), datum a kdy vás máme upozornit – pošleme vám email

### 3. Typy upozornění (ikony + krátký popis)
- 🔧 **Termín STK** – technická kontrola
- 🛡️ **Povinné ručení** – platnost pojištění
- 🚗 **Havarijní pojištění**
- 🔩 **Servisní prohlídka**
- 🛞 **Přezutí pneumatik**
- 🛣️ **Dálniční známka**
- 📝 **Jiné** – vlastní poznámka

### 4. Proč Moje VINInfo
- 📧 Email v termínu, který si zvolíte
- ✨ 100 % zdarma
- 🚗 Více vozidel na jednom místě
- 📊 Přehled termínů

### 5. CTA sekce
- **H2:** Začněte ještě dnes
- Text: Vytvořte si účet za minutu. Žádná platební karta, žádné předplatné.
- **Tlačítko:** Vytvořit účet zdarma

---

## SEO

- **Title:** Upozornění na STK a pojištění vozidla zdarma | VIN Info.cz
- **Meta description:** Nastavte si připomínky na termín STK, pojištění a servis. Pošleme vám email v termínu, který si zvolíte. Zdarma, bez předplatného. Uložte si vozidlo a nikdy nezmeškejte.
- **Klíčová slova:** upozornění STK, připomínka technická kontrola, připomenutí pojištění, upozornění na vozidlo

---

## Technické

- Přidat route `/upozorneni-na-terminy` v App.tsx
- Přidat do sitemap.xml
- Přidat odkaz v navigaci (např. pod „Historie vozu“ nebo v dropdown)
- Přidat odkaz ve footeru v sekci Navigace

---

## Wireframe (textový)

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]  Kontrola vozidla  Pojištění  Historie  [Účet]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Upozornění na termíny vozidla – STK, pojištění, servis  │
│  zdarma                                                  │
│                                                         │
│  Nikdy nezmeškejte důležitý termín. Uložte si vozidlo   │
│  do Moje VINInfo a nechte se emailem připomenout.       │
│                                                         │
│  [  Vytvořit účet zdarma  ]                             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Jak to funguje                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ 1. Zkontrolujte │ 2. Uložte si │ 3. Nastavte   │             │
│  │    vozidlo      │    vozidlo   │    upozornění │             │
│  └──────────┘  └──────────┘  └──────────┘             │
├─────────────────────────────────────────────────────────┤
│  Na co vás upozorníme                                   │
│  [STK] [Pojištění] [Servis] [Pneumatiky] [Dálnice]     │
├─────────────────────────────────────────────────────────┤
│  Proč Moje VINInfo?                                     │
│  • Email v zvolený termín  • 100% zdarma                 │
│  • Více vozidel           • Přehled v kalendáři         │
├─────────────────────────────────────────────────────────┤
│  Začněte ještě dnes                                     │
│  [  Vytvořit účet zdarma  ]                             │
├─────────────────────────────────────────────────────────┤
│  [Footer]                                               │
└─────────────────────────────────────────────────────────┘
```
