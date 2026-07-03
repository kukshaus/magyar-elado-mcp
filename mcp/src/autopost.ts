#!/usr/bin/env node
/**
 * autopost — fills marketplace posting forms from a listing package using
 * YOUR own browser session (persistent profile; you log in once, manually).
 *
 * Usage:
 *   node dist/autopost.js <package-dir> [--platform jofogas|hardverapro|facebook-marketplace|all] [--auto]
 *
 * Default flow per platform: open form -> wait for login if needed ->
 * fill title/price/description -> upload photos -> STOP for your review,
 * YOU click the submit button. `--auto` clicks submit for you (Jófogás /
 * HardverApró only — use at your own risk, it skips your review).
 *
 * Facebook Marketplace is intentionally NOT DOM-automated: scripted
 * activity there risks your whole personal account. The handler opens the
 * form and feeds your clipboard step by step instead.
 */
import { chromium, type BrowserContext, type Page, type Locator } from "playwright";
import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline/promises";

interface Listing {
  platform: string;
  title: string;
  priceHuf: number;
  category?: string;
  description: string;
}
interface ListingPackage {
  product: string;
  photosDir: string;
  listings: Listing[];
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const say = (msg: string) => console.log(msg);
const pause = (msg: string) => rl.question(`\n⏸  ${msg}\n   [Enter] ha kész... `);

function pbcopy(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform !== "darwin") return resolve();
    const p = execFile("pbcopy");
    p.stdin?.end(text);
    p.on("exit", () => resolve());
  });
}

async function loadPackage(dir: string): Promise<{ pkg: ListingPackage; photos: string[] }> {
  const abs = path.resolve(dir.replace(/^~(?=$|\/)/, os.homedir()));
  const pkg: ListingPackage = JSON.parse(await fs.readFile(path.join(abs, "listing.json"), "utf8"));
  const photoDir = path.join(abs, pkg.photosDir ?? "fotok");
  const photos = (await fs.readdir(photoDir))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort()
    .map((f) => path.join(photoDir, f));
  return { pkg, photos };
}

async function launchBrowser(): Promise<BrowserContext> {
  const profile = path.join(os.homedir(), ".magyar-elado", "browser-profile");
  await fs.mkdir(profile, { recursive: true });
  const options = { headless: false, viewport: null as null };
  for (const channel of ["chrome", "msedge"]) {
    try {
      return await chromium.launchPersistentContext(profile, { ...options, channel });
    } catch {
      /* try next */
    }
  }
  try {
    return await chromium.launchPersistentContext(profile, options);
  } catch (e) {
    throw new Error(
      `Nem találtam böngészőt. Telepíts Chrome-ot, vagy futtasd: npx playwright install chromium\n${e}`,
    );
  }
}

/** Try a list of locator candidates; fill the first that exists. */
async function tryFill(page: Page, label: string, value: string, candidates: (() => Locator)[]): Promise<boolean> {
  for (const make of candidates) {
    try {
      const loc = make().first();
      await loc.waitFor({ state: "visible", timeout: 2500 });
      await loc.click();
      await loc.fill(value, { timeout: 4000 });
      say(`   ✅ ${label}`);
      return true;
    } catch {
      /* next candidate */
    }
  }
  say(`   ⚠️  ${label}: nem találtam a mezőt — töltsd ki kézzel az átnézésnél.`);
  return false;
}

async function uploadPhotos(page: Page, photos: string[]): Promise<boolean> {
  try {
    const input = page.locator('input[type="file"]').first();
    await input.waitFor({ state: "attached", timeout: 8000 });
    await input.setInputFiles(photos);
    say(`   ✅ ${photos.length} fotó feltöltve`);
    return true;
  } catch {
    say(`   ⚠️  Fotófeltöltő mezőt nem találtam — húzd be a képeket kézzel.`);
    return false;
  }
}

/** If we landed on a login page, hand over to the user and wait. */
async function ensureLoggedIn(page: Page, loginUrlPattern: RegExp, formUrl: string): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  if (loginUrlPattern.test(page.url())) {
    await pause("Jelentkezz be a megnyílt böngészőben (a munkamenet megmarad a következő alkalmakra).");
    await page.goto(formUrl, { waitUntil: "domcontentloaded" });
  }
}

async function finishListing(page: Page, auto: boolean, submitCandidates: (() => Locator)[]): Promise<void> {
  if (auto) {
    for (const make of submitCandidates) {
      try {
        const btn = make().first();
        await btn.waitFor({ state: "visible", timeout: 3000 });
        await btn.click();
        say("   🚀 Beküldve (--auto).");
        await page.waitForLoadState("networkidle").catch(() => {});
        return;
      } catch {
        /* next */
      }
    }
    say("   ⚠️  Nem találtam a beküldés gombot — kattints rá kézzel.");
  }
  await pause("Nézd át a hirdetést a böngészőben, pótold amit jeleztem, és kattints a feladás gombra.");
}

async function postJofogas(page: Page, l: Listing, photos: string[], auto: boolean): Promise<void> {
  const formUrl = "https://www2.jofogas.hu/ai";
  say(`\n📦 Jófogás — ${l.title}`);
  await page.goto(formUrl, { waitUntil: "domcontentloaded" });
  await ensureLoggedIn(page, /jofogas\.hu\/belepes/, formUrl);
  await tryFill(page, "Cím", l.title, [
    () => page.locator('input[name="subject"]'),
    () => page.getByLabel(/hirdetés címe|cím/i),
    () => page.getByPlaceholder(/cím/i),
    () => page.locator('[data-testid*="subject" i] input, input[id*="subject" i]'),
  ]);
  await tryFill(page, "Leírás", l.description, [
    () => page.locator('textarea[name="body"]'),
    () => page.locator('textarea[name="description"]'),
    () => page.getByLabel(/leírás/i),
    () => page.locator("textarea"),
  ]);
  await tryFill(page, "Ár", String(l.priceHuf), [
    () => page.locator('input[name="price"]'),
    () => page.getByLabel(/^ár/i),
    () => page.getByPlaceholder(/ár/i),
    () => page.locator('input[type="number"]'),
  ]);
  if (l.category) say(`   ℹ️  Kategória (válaszd ki kézzel): ${l.category}`);
  await uploadPhotos(page, photos);
  await finishListing(page, auto, [
    () => page.getByRole("button", { name: /felad|tovább|közzétesz/i }),
    () => page.locator('button[type="submit"]'),
  ]);
}

async function postHardverapro(page: Page, l: Listing, photos: string[], auto: boolean): Promise<void> {
  const formUrl = "https://hardverapro.hu/hirdetesfeladas/uj.php";
  say(`\n📦 HardverApró — ${l.title}`);
  await page.goto(formUrl, { waitUntil: "domcontentloaded" });
  await ensureLoggedIn(page, /belepes|azonosit|login/i, formUrl);
  if (l.category) say(`   ℹ️  Kategória (válaszd ki kézzel): ${l.category}`);
  await tryFill(page, "Cím", l.title, [
    () => page.locator('input[name="title"]'),
    () => page.locator('input[name="stitle"]'),
    () => page.getByLabel(/cím/i),
    () => page.getByPlaceholder(/cím/i),
  ]);
  await tryFill(page, "Leírás", l.description, [
    () => page.locator('textarea[name="descr"]'),
    () => page.locator('textarea[name="description"]'),
    () => page.getByLabel(/leírás|szöveg/i),
    () => page.locator("textarea"),
  ]);
  await tryFill(page, "Ár", String(l.priceHuf), [
    () => page.locator('input[name="price"]'),
    () => page.getByLabel(/^ár/i),
    () => page.locator('input[type="number"]'),
  ]);
  await uploadPhotos(page, photos);
  await finishListing(page, auto, [
    () => page.getByRole("button", { name: /felad|tovább|mentés/i }),
    () => page.locator('button[type="submit"], input[type="submit"]'),
  ]);
}

/** Facebook: open + clipboard walkthrough only — no DOM automation. */
async function postFacebook(page: Page, l: Listing, photos: string[]): Promise<void> {
  say(`\n📦 Facebook Marketplace — ${l.title}`);
  say("   (Itt szándékosan nincs automatikus kitöltés: a scriptelt aktivitás");
  say("   a teljes Facebook-fiókod felfüggesztését kockáztatná.)");
  await page.goto("https://www.facebook.com/marketplace/create/item", { waitUntil: "domcontentloaded" });
  await pbcopy(l.title);
  await pause("A CÍM a vágólapodon van — illeszd be (⌘V), állítsd be az árat: " + l.priceHuf + " Ft.");
  await pbcopy(l.description);
  await pause(`A LEÍRÁS a vágólapodon van — illeszd be, majd húzd be a fotókat innen: ${path.dirname(photos[0] ?? "")}`);
}

// ---- main ----
const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const platformArg = args.includes("--platform") ? args[args.indexOf("--platform") + 1] : "all";
const auto = args.includes("--auto");
if (!dir) {
  say("Használat: autopost <hirdetéscsomag-mappa> [--platform jofogas|hardverapro|facebook-marketplace|all] [--auto]");
  process.exit(1);
}

const { pkg, photos } = await loadPackage(dir);
if (photos.length === 0) {
  say("⚠️  Nincs kép a fotok/ mappában — előbb tedd bele a fotókat, azok adják el a terméket.");
  process.exit(1);
}
const wanted = pkg.listings.filter((l) => platformArg === "all" || l.platform === platformArg);
if (wanted.length === 0) {
  say(`Nincs '${platformArg}' hirdetés a csomagban. Elérhető: ${pkg.listings.map((l) => l.platform).join(", ")}`);
  process.exit(1);
}

say(`🛒 ${pkg.product} — ${wanted.length} hirdetés, ${photos.length} fotó`);
if (auto) say("⚠️  --auto mód: a script maga kattint a feladás gombra Jófogáson/HardverAprón.");
const browser = await launchBrowser();
const page: Page = browser.pages()[0] ?? (await browser.newPage());

for (const l of wanted) {
  try {
    if (l.platform === "jofogas") await postJofogas(page, l, photos, auto);
    else if (l.platform === "hardverapro") await postHardverapro(page, l, photos, auto);
    else if (l.platform === "facebook-marketplace") await postFacebook(page, l, photos);
    else say(`\n⚠️  '${l.platform}' feladását nem támogatom — használd a ${l.platform}.md fájlt kézzel.`);
  } catch (e) {
    say(`\n❌ ${l.platform}: ${e instanceof Error ? e.message : e}`);
    await pause("Folytasd/javítsd kézzel a böngészőben, aztán Enter a következő platformhoz.");
  }
}

say("\n✅ Kész. Ha minden hirdetés kint van: eladás után mindet töröld!");
await pause("Enter a böngésző bezárásához.");
await browser.close();
rl.close();
