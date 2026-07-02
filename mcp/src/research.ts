/**
 * Price research on Hungarian marketplaces.
 * - HardverApró: HTML search results (needs a session-cookie handshake)
 * - Jófogás: listing data embedded as JSON in the search results page
 */
import * as cheerio from "cheerio";

export interface PriceHit {
  platform: "hardverapro" | "jofogas";
  title: string;
  priceHuf: number;
  url: string;
  companyAd?: boolean;
}

export interface PriceStats {
  count: number;
  minHuf: number;
  medianHuf: number;
  maxHuf: number;
  /** ~10% below median — realistic for a sale within days */
  quickSaleHuf: number;
  /** median of comparable listings */
  marketHuf: number;
  /** ~10% above median — leaves room for bargaining */
  patientHuf: number;
  note: string;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// Session cookies persist for the server's lifetime — HardverApró's
// auth handshake (auth.rios.hu -> azonosit.php) needs a beat before the
// session is recognized, so a warm cookie store is what makes search work.
const sessionCookies = new Map<string, string>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch() with manual redirect following + an in-memory cookie store.
 * HardverApró bounces through /muvelet/hozzaferes/azonosit.php to set
 * session cookies before serving search results; undici's automatic
 * redirects drop those cookies, so we carry them by hand.
 */
async function fetchWithSession(
  startUrl: string,
  cookies: Map<string, string> = new Map(),
): Promise<{ html: string; finalUrl: string }> {
  let url = startUrl;
  for (let hop = 0; hop < 10; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "hu-HU,hu;q=0.9,en;q=0.8",
        ...(cookies.size > 0
          ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") }
          : {}),
      },
      signal: AbortSignal.timeout(20000),
    });
    for (const sc of res.headers.getSetCookie()) {
      const pair = sc.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error(`Redirect without Location from ${url}`);
      await res.arrayBuffer().catch(() => {});
      url = new URL(loc, url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return { html: await res.text(), finalUrl: url };
  }
  throw new Error(`Too many redirects starting from ${startUrl}`);
}

/** "289 990 Ft" / "289&nbsp;990 Ft" -> 289990; null when not a price */
function parseHuf(text: string): number | null {
  const digits = text.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function hardveraproSearchUrl(query: string): string {
  const q = encodeURIComponent(query);
  // The full form parameter set is required — keres.php redirects to the
  // index page (dropping the query) when the extra fields are missing.
  return (
    `https://hardverapro.hu/aprok/keres.php?stext=${q}` +
    `&stcid_text=&stcid=&stmid_text=&stmid=&minprice=&maxprice=` +
    `&cmpid_text=&cmpid=&usrid_text=&usrid=&__buying=0&stext_none=`
  );
}

export async function searchHardverapro(query: string, limit = 25): Promise<PriceHit[]> {
  const searchUrl = hardveraproSearchUrl(query);
  let html = "";
  // A fresh session's first search gets bounced to the index page (the
  // query is dropped); once the handshake settles the same URL works.
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetchWithSession(searchUrl, sessionCookies);
    if (res.finalUrl.includes("keres.php")) {
      html = res.html;
      break;
    }
    await sleep(1500 * (attempt + 1));
  }
  if (!html) {
    throw new Error(
      "HardverApró search kept redirecting to the index page (session not accepted). " +
        `Fall back to manual research: ${searchUrl}`,
    );
  }
  const $ = cheerio.load(html);
  const hits: PriceHit[] = [];
  $("li.media").each((_, el) => {
    if (hits.length >= limit) return;
    const cls = $(el).attr("class") ?? "";
    // "featured" rows are paid promotions unrelated to the query;
    // "uad-status-iced" listings are frozen/inactive.
    if (cls.includes("featured") || cls.includes("uad-status-iced")) return;
    const a = $(".uad-col-title h1 a", el).first();
    const title = a.text().trim();
    const href = a.attr("href") ?? "";
    const price = parseHuf($(".uad-price", el).first().text());
    if (!title || price === null) return;
    hits.push({
      platform: "hardverapro",
      title,
      priceHuf: price,
      url: href.startsWith("http") ? href : `https://hardverapro.hu${href}`,
      companyAd: cls.includes("uad-business-user"),
    });
  });
  return hits;
}

export function jofogasSearchUrl(query: string): string {
  return `https://www.jofogas.hu/magyarorszag?q=${encodeURIComponent(query)}`;
}

export async function searchJofogas(query: string, limit = 25): Promise<PriceHit[]> {
  const { html } = await fetchWithSession(jofogasSearchUrl(query));
  // Listings live in embedded JSON: {"list_id":..., "url":"...", "subject":"...",
  // "price":{"label":"340 000 Ft"...}, "company_ad":false, ...}
  const chunks = html.split('"list_id":').slice(1);
  const hits: PriceHit[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    if (hits.length >= limit) break;
    const url = /"url":"(https:(?:[^"\\]|\\.)+?\.htm)"/.exec(chunk)?.[1];
    const rawSubject = /"subject":"((?:[^"\\]|\\.)*)"/.exec(chunk)?.[1];
    const rawPrice = /"price":\{"label":"([^"]+)"/.exec(chunk)?.[1];
    const companyAd = /"company_ad":(true|false)/.exec(chunk)?.[1] === "true";
    if (!url || !rawSubject || !rawPrice) continue;
    let title: string;
    let cleanUrl: string;
    try {
      title = JSON.parse(`"${rawSubject}"`);
      cleanUrl = JSON.parse(`"${url}"`);
    } catch {
      continue;
    }
    if (seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);
    const price = parseHuf(rawPrice);
    if (price === null) continue;
    hits.push({ platform: "jofogas", title, priceHuf: price, url: cleanUrl, companyAd });
  }
  return hits;
}

/**
 * Stats over hits whose title contains every significant token of the query
 * (search pages mix in sponsored/loosely-related items). Falls back to all
 * hits when the strict filter leaves too few.
 */
export function computeStats(query: string, hits: PriceHit[]): PriceStats | null {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  let relevant = hits.filter((h) => {
    const t = h.title.toLowerCase();
    return tokens.every((tok) => t.includes(tok));
  });
  if (relevant.length < 3) relevant = hits;
  if (relevant.length === 0) return null;

  let prices = relevant.map((h) => h.priceHuf).sort((a, b) => a - b);
  const median = (arr: number[]) =>
    arr.length % 2 ? arr[(arr.length - 1) / 2] : Math.round((arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2);
  // Drop outliers (accessories, bundles, scams) relative to the raw median.
  const rawMedian = median(prices);
  const trimmed = prices.filter((p) => p >= rawMedian * 0.35 && p <= rawMedian * 3);
  if (trimmed.length >= 3) prices = trimmed;

  const m = median(prices);
  const round = (n: number) => Math.round(n / 500) * 500;
  return {
    count: prices.length,
    minHuf: prices[0],
    medianHuf: m,
    maxHuf: prices[prices.length - 1],
    quickSaleHuf: round(m * 0.9),
    marketHuf: round(m),
    patientHuf: round(m * 1.1),
    note:
      "A statisztika a keresésre szűrt, kilógó áraktól megtisztított hirdetésekből készült. " +
      "Ellenőrizd a találatok relevanciáját (állapot, garancia, bolti vs. magán) az ár véglegesítése előtt.",
  };
}
