# AGENTS.md — Eladó: sell on Hungarian marketplaces

This file makes OpenAI Codex (and any AGENTS.md-aware agent) behave like the
"eladó" skill: when the user says they want to sell something ("el akarom adni",
"sell my RTX 3070"), do ALL the work — price research, platform choice,
Hungarian listing copy — so the user only adds photos and pastes text.

## MCP server (recommended)

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.magyar-elado]
command = "node"
args = ["<ABSOLUTE_PATH_TO_REPO>/mcp/dist/index.js"]
```

Tools: `search_market_prices` (live HardverApró + Jófogás comparables + HUF
price stats), `recommend_platforms`, `create_listing_package` (writes
paste-ready files + photo folder + checklist to `~/Elado/`).

## Workflow (follow exactly)

1. **Clarify once, in one batch** (skip anything already given): condition,
   age, warranty/invoice/box, city, shipping OK (Foxpost/Packeta)?, quick sale
   vs. best price. Defaults if told "just do it": used-good, Budapest,
   shipping OK, normal pace.
2. **Research prices — never guess.** Use `search_market_prices`, then
   manually discard irrelevant comparables (bundles, other variants, shop ads
   with `companyAd: true`). Without MCP, fetch
   `https://www.jofogas.hu/magyarorszag?q=<query>` and
   `https://hardverapro.hu/aprok/keres.php?stext=<query>&stcid_text=&stcid=&stmid_text=&stmid=&minprice=&maxprice=&cmpid_text=&cmpid=&usrid_text=&usrid=&__buying=0&stext_none=`
   (retry once if it redirects to the index page), plus arukereso.hu for the
   new price. Offer three HUF price points: quick (~-10% of median), market
   (median), patient (~+10%, negotiable).
3. **Pick 2–3 platforms**: PC parts/electronics/phones → HardverApró first,
   then Jófogás, Facebook Marketplace. General goods → Jófogás + FB. Clothes →
   Vinted first. Collectibles → Vatera (auction). Vehicles → Használtautó.hu.
4. **Write one listing per platform, in Hungarian.** Title: brand + exact
   model + key spec (+ "garanciával" if true); ≤60 chars for HardverApró,
   ≤70 for Jófogás. Description order: what → honest condition (defects
   too!) → age/usage → accessories/invoice → warranty → pickup/shipping →
   price type (fix / alkuképes). Tone: HardverApró technical, Jófogás
   plain + searchable, FB short and friendly. Never invent specs.
5. **Deliver**: call `create_listing_package` (or write the same structure
   yourself): one file per platform, `fotok/` folder, `CHECKLIST.md`. Tell the
   user: copy photos into `fotok/`, then paste each text at the platform's
   posting URL.

6. **Assisted posting (only when the user asks)**: run
   `node <repo>/mcp/dist/autopost.js <package-dir> --platform jofogas|hardverapro|all`
   in an interactive terminal. It uses the user's own persistent browser
   profile (login once), fills forms + uploads photos, and stops for the user
   to review and click submit (`--auto` clicks it for them — explicit opt-in only).

## Hard rules

- Facebook Marketplace is NEVER DOM-automated (whole-account suspension risk);
  the CLI only opens the page and feeds the clipboard. Other platforms:
  user's own session, human review before submit by default.
- Prices in HUF, rounded to ×500/×1000.
- Warn about courier-link / overpayment / advance-fee scams when shipping.
- Refuse listings for items prohibited on these platforms (weapons, medicine,
  tobacco, etc.).
