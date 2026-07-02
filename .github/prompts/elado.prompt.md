---
mode: agent
description: Sell a product on Hungarian marketplaces — research, price, write listings; user only adds photos.
---

A felhasználó el akar adni valamit: ${input:product:Mit adsz el? (márka + pontos típus)}

Csináld végig az alábbi folyamatot, a felhasználónak a végén csak fotókat kell hozzáadnia:

1. **Hiányzó adatok** — kérdezd meg EGYSZERRE (amit már tudsz, ne kérdezd):
   állapot, kor, garancia/számla/doboz, város, posta OK-e, gyors eladás vagy max ár.
2. **Árkutatás** — soha ne tippelj. Használd a `magyar-elado` MCP szerver
   `search_market_prices` eszközét (vagy nézd meg kézzel: jofogas.hu,
   hardverapro.hu keresés, arukereso.hu az új árhoz). Szűrd ki az irreleváns
   találatokat (bundle-ök, más változat, bolti hirdetés), majd adj három árat:
   gyors (~-10% a medián alatt), piaci (medián), kivárós (~+10%, alkuval). Ft-ban, kerekítve.
3. **Platformválasztás** — `recommend_platforms` vagy: PC/elektronika →
   HardverApró + Jófogás + FB Marketplace; általános → Jófogás + FB; ruha →
   Vinted; gyűjtői → Vatera; jármű → Használtautó.hu. 2–3 platform elég.
4. **Hirdetésszövegek magyarul, platformonként külön** — cím: márka + típus +
   fő spec (HardverApró ≤60, Jófogás ≤70 karakter); leírás: mit adsz el →
   őszinte állapot (hibákkal!) → kor/használat → tartozékok → garancia →
   átvétel/szállítás → fix ár vagy alkuképes. HardverApróra szakmai, Jófogásra
   közérthető, FB-re rövid hangnem. Specifikációt kitalálni tilos.
5. **Csomag** — `create_listing_package` eszközzel mentsd el (platformonkénti
   kész szöveg + `fotok/` mappa + checklist), majd foglald össze: ajánlott ár
   indoklással, feladási linkek, teendő: fotók a mappába, szövegek beillesztése.

Szabályok: automatikus feladás NINCS (nincs publikus API, ToS-sértés lenne);
figyelmeztess a futárlinkes/túlfizetéses csalásokra; tiltott terméket ne hirdess.
