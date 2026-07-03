---
name: elado
description: Sell a product on Hungarian marketplaces (Jófogás, HardverApró, Facebook Marketplace, Vatera, Vinted, Használtautó). Use when the user wants to sell something — "el akarom adni", "eladnám", "sell my RTX 3070", "list this for sale". Researches live market prices, recommends the best platforms, writes Hungarian listing texts, and saves a ready-to-post package. The user only needs to add photos and paste.
---

# Eladó — sell anything on the Hungarian second-hand market

You do ALL the work: research, pricing, platform choice, listing copy.
The user's only job at the end: **drop photos into a folder and copy-paste the prepared texts.**

## Step 0 — What is being sold?

Extract from the user's message: product (brand + exact model), and if mentioned: condition, age, accessories, location, urgency.

If essentials are missing, ask ONCE, in a single compact question batch (never one-by-one):
1. Állapot? (új / újszerű / használt / hibás — és van-e kozmetikai hiba)
2. Mikor és hol vetted? Van-e még **garancia és számla/doboz**?
3. Hol vagy (város)? Postáznád is (Foxpost/Packeta), vagy csak személyes átvétel?
4. Gyorsan kell a pénz, vagy kivárnád a legjobb árat?

Sensible defaults if the user says "just do it": használt-jó állapot, Budapest, posta OK, normál tempó.

## Step 1 — Price research (never guess a price)

**Preferred:** MCP tools from the `magyar-elado` server:
- `search_market_prices` with a specific query (e.g. `"RTX 3070 8GB"`). Returns live HardverApró + Jófogás hits and price stats (quickSale / market / patient, HUF).
- **Critically review the hits before trusting the stats**: discard bundles (full gamer PCs when selling a bare GPU), different variants (Ti/SUPER, other storage size), shop/company ads with warranty pricing (`companyAd: true` is a hint), and wrecks. If many hits are irrelevant, re-run with a tighter query or recompute mentally from the relevant subset.

**Fallback** (no MCP server): WebFetch/WebSearch these, read prices manually:
- `https://hardverapro.hu/aprok/keres.php?stext=<query>&stcid_text=&stcid=&stmid_text=&stmid=&minprice=&maxprice=&cmpid_text=&cmpid=&usrid_text=&usrid=&__buying=0&stext_none=` (may need a retry — first hit of a session redirects to the index page)
- `https://www.jofogas.hu/magyarorszag?q=<query>`
- `https://www.arukereso.hu/CategorySearch.php?st=<query>` for the NEW price as an anchor.

Produce three price points and explain them to the user:
- **Gyors eladás** (~10% a medián alatt), **Piaci ár** (medián), **Kivárós** (~10% felette, alkuval).
- Adjust for the user's actual condition/warranty vs. the comparables (garancia + számla = +5–15%).

## Step 2 — Platform choice

Use `recommend_platforms` (MCP) or this heuristic:

| Termék | Platformok (sorrendben) |
|---|---|
| PC-alkatrész, elektronika, telefon, konzol | **HardverApró**, Jófogás, FB Marketplace |
| Általános (bútor, gép, sport, gyerek) | **Jófogás**, FB Marketplace |
| Ruha, cipő, táska | **Vinted**, Jófogás, FB Marketplace |
| Gyűjtői, régiség, ritkaság | **Vatera** (licit!), Jófogás |
| Autó, motor | **Használtautó.hu**, FB Marketplace, Jófogás |

Pick 2–3. More platforms ≠ better: every extra listing must be maintained and taken down after sale.

## Step 3 — Write the listings (Hungarian!)

Write a SEPARATE text per platform — never one generic blob. Rules:

- **Cím**: márka + pontos típus + fő spec + ütős extra ("garanciával"). HardverApró/Vatera: max 60 char; Jófogás: max 70.
- **Leírás** tartalma, ebben a sorrendben: mit adok el (pontos típus) → állapot őszintén (hibát is!) → kor + használat jellege → tartozékok (doboz, számla, kábelek) → garancia → átvétel/szállítás (város, Foxpost/Packeta utánvét) → ár jellege ("fix ár" vagy "az ár minimálisan alkuképes").
- **Hangnem platformonként**: HardverApró = tárgyilagos, spec-fókuszú (a közönség szakértő, benchmark/üzemóra jó pont); Jófogás = közérthető, kereshető kulcsszavakkal; FB Marketplace = rövid, barátságos; Vatera = gyűjtői részletek.
- Őszinteség kötelező: a rejtett hiba visszaküldést és rossz értékelést szül.
- Never invent specs — if unsure about a detail (VRAM size, year), ask or verify by web search.

## Step 4 — Deliver the package

With MCP: call `create_listing_package` (writes `~/Elado/<date>-<slug>/` with one paste-ready file per platform, a `listing.json`, a `fotok/` folder and `CHECKLIST.md`).
Without MCP: write the same structure yourself with the Write tool.

Then give the user a compact summary:
1. Ajánlott ár + indoklás (hány összehasonlító hirdetés, medián).
2. Platformok + feladási linkek.
3. **Teendőd: másold a fotókat a `fotok/` mappába, majd platformonként illeszd be a kész szöveget.** Fotótippek a checklistben.

## Step 5 — Assisted posting (when the user asks to automate it)

Once photos are in `fotok/`, run the autopost CLI from this project's `mcp/` dir (in a visible terminal — it's interactive):

```bash
node <repo>/mcp/dist/autopost.js ~/Elado/<package-dir> --platform jofogas   # or hardverapro | all
```

It opens a persistent browser profile (`~/.magyar-elado/browser-profile`) where the user logs in ONCE, then fills title/price/description and uploads the photos. **Default: the user reviews and clicks the submit button themselves.** `--auto` clicks submit too — only pass it if the user explicitly asks. If the script can't find a field (sites change), it says so and the user fills that one field by hand.

## Hard rules

- **Facebook Marketplace is never DOM-automated** — scripted activity risks the user's entire personal account. The autopost CLI only opens the page and feeds the clipboard; the rest of the platforms use the user's own session with human review before submit by default.
- Prices always in HUF, rounded to a "nice" value (× 500 / × 1000).
- Warn about the standard scams if shipping is involved (fake courier links, "overpayment", advance-fee buyers).
- If the product is regulated or prohibited on these platforms (fegyver, gyógyszer, dohány, élő állat szabályok stb.), stop and tell the user instead of drafting listings.
