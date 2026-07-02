# magyar-eladó — sell anything on the Hungarian second-hand market

Say **"el akarom adni a GeForce RTX 3070-emet"** to your AI assistant and it
does everything: researches live prices on HardverApró and Jófogás, picks the
best Hungarian platforms, writes honest Hungarian listing texts per platform,
and saves a ready-to-post package. **You only add photos and paste.**

Deliberately NOT included: automatic posting. Jófogás, Facebook Marketplace,
HardverApró and Vatera have no public posting APIs, and automating their web
UIs violates their terms of service.

## Components

| Path | What it is |
|---|---|
| `mcp/` | MCP server (Node ≥20): live price research + platform recommendation + listing package writer |
| `skills/elado/SKILL.md` | Claude Code skill (`/elado` or just say you want to sell something) |
| `AGENTS.md` | Same workflow for OpenAI Codex |
| `.github/copilot-instructions.md` + `.github/prompts/elado.prompt.md` | Same workflow for GitHub Copilot (`/elado` prompt in VS Code) |
| `.vscode/mcp.json` | MCP wiring for VS Code Copilot agent mode |

## Setup

```bash
cd mcp && npm install && npm run build
```

### Claude Code

```bash
# Skill (global — available in every project)
mkdir -p ~/.claude/skills/elado
cp skills/elado/SKILL.md ~/.claude/skills/elado/

# MCP server (global)
claude mcp add --scope user magyar-elado -- node "$(pwd)/dist/index.js"
```

### Codex

Add to `~/.codex/config.toml` (see `AGENTS.md`):

```toml
[mcp_servers.magyar-elado]
command = "node"
args = ["/absolute/path/to/magyar-eladó-mcp/mcp/dist/index.js"]
```

### Copilot (VS Code)

Open this folder in VS Code — `.vscode/mcp.json` and the prompt file are
picked up automatically. Start with `/elado` in Copilot Chat (agent mode).

## MCP tools

- `search_market_prices { query }` — live comparable listings from
  HardverApró + Jófogás with HUF stats (median, quick-sale, patient price).
- `recommend_platforms { product }` — ranked Hungarian platforms
  (HardverApró, Jófogás, FB Marketplace, Vatera, Vinted, Használtautó) with
  posting URLs, fees, title limits.
- `create_listing_package { product, listings[] }` — writes
  `~/Elado/<date>-<product>/` with one paste-ready file per platform, a
  `fotok/` folder for your pictures, and `CHECKLIST.md`.

## Notes

- Scrapers parse public search pages; if a site changes its markup, the tools
  degrade gracefully and the assistant falls back to manual web research.
- HardverApró needs a session handshake; the first search of a fresh session
  is retried automatically.
