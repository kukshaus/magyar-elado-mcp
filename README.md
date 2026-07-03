# 🇭🇺 magyar-eladó — AI selling assistant for Hungarian marketplaces

**Tell your AI assistant *"sell my RTX 3070"* — it researches live prices, picks the right Hungarian platforms, and writes the listings. You only add photos.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js ≥20](https://img.shields.io/badge/Node.js-%E2%89%A520-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/Model%20Context%20Protocol-server-blue)](https://modelcontextprotocol.io)
[![Works with: Claude Code](https://img.shields.io/badge/Claude%20Code-skill-orange)](#-claude-code)
[![Works with: Codex](https://img.shields.io/badge/OpenAI%20Codex-AGENTS.md-lightgrey)](#-openai-codex)
[![Works with: Copilot](https://img.shields.io/badge/GitHub%20Copilot-prompt-blueviolet)](#-github-copilot-vs-code)

Free and open source. No accounts, no API keys, no fees — it reads public
marketplace data and writes files on your machine.

---

## 💬 What it looks like

> **You:** El akarom adni a GeForce RTX 3070-emet, dobozzal, számla nélkül, Budapesten.
>
> **AI:** *(researches 45 live listings on HardverApró + Jófogás)*
> A jelenlegi piac alapján (23 releváns hirdetés, medián 118 000 Ft):
> - ⚡ **Gyors eladás: 105 000 Ft** (pár nap alatt elkel)
> - 🎯 **Piaci ár: 115 000 Ft** (ajánlott)
> - 🐢 **Kivárós: 128 000 Ft** ("alkuképes" megjelöléssel)
>
> Feladásra kész hirdetéseket írtam **HardverApróra, Jófogásra és Facebook
> Marketplace-re** — mindet ide mentettem: `~/Elado/2026-07-02-geforce-rtx-3070/`
>
> **A te dolgod:** másold a fotókat a `fotok/` mappába, majd illeszd be a kész
> szövegeket (a CHECKLIST.md végigvezet, linkekkel).

## ✨ What it does

| | |
|---|---|
| 🔍 **Live price research** | Scrapes real, current listings from **HardverApró** and **Jófogás**, filters out bundles/outliers, and computes quick-sale / market / patient price points in HUF |
| 🧭 **Platform matchmaking** | GPU → HardverApró · sofa → Jófogás + FB Marketplace · sneakers → Vinted · coin collection → Vatera · car → Használtautó.hu |
| ✍️ **Native Hungarian listings** | A separate, honest, platform-idiomatic text for each site — correct title limits, right tone for each audience (HardverApró readers want benchmarks, Facebook wants friendly and short) |
| 📦 **Ready-to-post package** | One paste-ready file per platform + a `fotok/` folder for your pictures + a posting checklist with direct links and photo tips |
| 🛡️ **Scam-aware** | Built-in warnings about the classic Hungarian marketplace scams (fake courier links, overpayment, advance-fee "buyers") |

| 🤖 **Assisted posting (Playwright)** | Optional `autopost` CLI: opens *your* logged-in browser profile, fills the Jófogás / HardverApró forms and uploads your photos — **you review and click the final submit button** (or pass `--auto` at your own risk) |

```bash
# after photos are in the package's fotok/ folder:
node mcp/dist/autopost.js ~/Elado/<package-dir> --platform all
```

First run: log in once in the opened browser window — the session persists in
`~/.magyar-elado/browser-profile`. No credentials ever touch the code.

**Honest limits:** these platforms have no public posting APIs, and heavy
automation violates their terms — that's why the default keeps a human on the
submit button. **Facebook Marketplace is never DOM-automated** (scripted
activity there can suspend your whole personal account); for FB the tool opens
the form and feeds your clipboard step by step instead.

## 🚀 Quick start

```bash
git clone https://github.com/kukshaus/magyar-elado-mcp.git
cd magyar-elado-mcp/mcp && npm install && npm run build
```

### 🟠 Claude Code

```bash
# install the skill globally (works in every project)
mkdir -p ~/.claude/skills/elado
cp ../skills/elado/SKILL.md ~/.claude/skills/elado/

# register the MCP server
claude mcp add --scope user magyar-elado -- node "$(pwd)/dist/index.js"
```

Restart Claude Code, then just say what you want to sell — or type `/elado`.

### ⚪ OpenAI Codex

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.magyar-elado]
command = "node"
args = ["/absolute/path/to/magyar-elado-mcp/mcp/dist/index.js"]
```

The repo's [`AGENTS.md`](AGENTS.md) teaches Codex the full workflow automatically.

### 🟣 GitHub Copilot (VS Code)

Open this folder in VS Code — [`.vscode/mcp.json`](.vscode/mcp.json) and the
[`/elado` prompt](.github/prompts/elado.prompt.md) are picked up automatically.
In Copilot Chat (agent mode), type `/elado`.

## 🧰 MCP tools

The server exposes three tools any MCP client can use:

| Tool | What it returns |
|---|---|
| `search_market_prices { query }` | Live comparable listings from HardverApró + Jófogás, with HUF statistics: median, quick-sale (−10%) and patient (+10%) suggestions, outliers trimmed |
| `recommend_platforms { product }` | Ranked Hungarian platforms with reasons, fees, posting URLs and title-length limits |
| `create_listing_package { product, listings[] }` | Writes `~/Elado/<date>-<product>/` — paste-ready text per platform, `fotok/` photo folder, `CHECKLIST.md` |

Example package on disk:

```
~/Elado/2026-07-02-geforce-rtx-3070/
├── CHECKLIST.md          ← step-by-step posting guide with links
├── hardverapro.md        ← paste-ready: title, price, category, description
├── jofogas.md
├── facebook-marketplace.md
└── fotok/                ← drop your photos here
```

## 🏪 Supported platforms

| Platform | Best for | Fees (private sellers) |
|---|---|---|
| [HardverApró](https://hardverapro.hu) | PC parts, electronics, phones, consoles | free |
| [Jófogás](https://www.jofogas.hu) | everything — Hungary's biggest classifieds | mostly free |
| [Facebook Marketplace](https://www.facebook.com/marketplace) | local pickup, bulky items | free |
| [Vinted](https://www.vinted.hu) | clothes, shoes, bags | free (buyer pays protection) |
| [Vatera](https://www.vatera.hu) | collectibles, rarities (auctions!) | commission on sale |
| [Használtautó.hu](https://www.hasznaltauto.hu) | cars, motorcycles | paid listing |

## ⚙️ How the research works

- **Jófogás** embeds listing data as JSON in its search pages — parsed directly.
- **HardverApró** requires a session-cookie handshake and the full search
  parameter set; a fresh session's first search gets bounced to the homepage,
  so the client retries with the warmed session automatically.
- Statistics filter hits to those matching your query tokens and trim
  outliers (accessories, bundles, scam prices) before computing the median.
- If a site changes its markup, tools degrade gracefully and your AI falls
  back to manual web research — nothing breaks silently.

## ❓ FAQ

**Is it really free?** Yes — MIT licensed, no accounts or API keys. Your AI
assistant (Claude/Codex/Copilot) is the only thing you pay for, as usual.

**Why doesn't it post the listings for me?** No Hungarian marketplace offers a
public posting API, and scripting their web UIs breaks their terms of service
and can get your account banned. Copy-paste takes 30 seconds per platform.

**Does it work for markets outside Hungary?** The listing-writing workflow is
generic, but the scrapers and platform registry are Hungary-specific. Fork it
and swap `mcp/src/platforms.ts` + `mcp/src/research.ts` for your country's
sites — PRs for other markets are welcome.

**A HardverApró/Jófogás átalakította az oldalát és nem jön ár?** Nyiss egy
issue-t — a szelektorok a `mcp/src/research.ts`-ben vannak, jellemzően
pár soros javítás.

## 🇭🇺 Magyar összefoglaló

Mondd az AI-odnak: *„el akarom adni a laptopomat"* — ő megnézi az aktuális
árakat a HardverAprón és a Jófogáson, javasol reális árat (gyors / piaci /
kivárós), kiválasztja a legjobb platformokat, és **kész magyar hirdetés-
szövegeket ír mindegyikre**. Neked csak a fotókat kell hozzáadnod és
beilleszteni a szöveget. Ingyenes, nyílt forráskódú, nem kér semmilyen
fiókot vagy API-kulcsot.

## 🤝 Contributing

Issues and PRs welcome — especially: new platforms (Marketplace groups,
eBay-Kleinanzeigen-style sites for other countries), better comparable
filtering, and selector fixes when sites change their markup.

## 📄 License

[MIT](LICENSE) — use it, fork it, sell your stuff.
