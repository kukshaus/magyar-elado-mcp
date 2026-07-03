/**
 * Writes a ready-to-post "listing package" to disk:
 * one file per platform with paste-ready text, a photo drop folder,
 * and a posting checklist.
 */
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { PLATFORMS } from "./platforms.js";

export interface ListingDraft {
  platform: string;
  title: string;
  priceHuf: number;
  category?: string;
  description: string;
}

export interface PackageInput {
  product: string;
  listings: ListingDraft[];
  outputDir?: string;
  photoTips?: string[];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const formatHuf = (n: number) => `${n.toLocaleString("hu-HU")} Ft`;

const DEFAULT_PHOTO_TIPS = [
  "Készíts 4-8 képet természetes fénynél, semleges háttér előtt.",
  "Fotózd le a termék minden oldalát, a típuscímkét/sorozatszámot is.",
  "Ha van hibája/kopása, azt KÜLÖN képen mutasd meg — ez bizalmat épít.",
  "Dobozt, számlát, tartozékokat egy közös képen érdemes megmutatni.",
  "Működés közbeni kép (bekapcsolt kijelző, futó program) sokat ér.",
];

export async function writeListingPackage(input: PackageInput): Promise<{
  dir: string;
  files: string[];
}> {
  const slug = slugify(input.product) || "termek";
  const date = new Date().toISOString().slice(0, 10);
  const dir = input.outputDir
    ? path.resolve(input.outputDir.replace(/^~(?=$|\/)/, os.homedir()))
    : path.join(os.homedir(), "Elado", `${date}-${slug}`);
  const photoDir = path.join(dir, "fotok");
  await fs.mkdir(photoDir, { recursive: true });

  const files: string[] = [];

  for (const listing of input.listings) {
    const p = PLATFORMS.find((x) => x.id === listing.platform);
    const name = p?.name ?? listing.platform;
    const lines = [
      `# ${name} — ${input.product}`,
      "",
      `**Feladás itt:** ${p?.postUrl ?? "(keresd a platform 'hirdetésfeladás' menüpontját)"}`,
      "",
      "## Cím (másold be)",
      "",
      "```",
      listing.title,
      "```",
      "",
      `## Ár: ${formatHuf(listing.priceHuf)}`,
      "",
      ...(listing.category ? [`## Kategória: ${listing.category}`, ""] : []),
      "## Leírás (másold be)",
      "",
      "```",
      listing.description,
      "```",
      "",
      ...(p?.notes ? ["## Platform tipp", "", p.notes, ""] : []),
    ];
    const file = path.join(dir, `${listing.platform}.md`);
    await fs.writeFile(file, lines.join("\n"), "utf8");
    files.push(file);
  }

  const checklist = [
    `# Feladási checklist — ${input.product}`,
    "",
    "## 1. Fotók",
    "",
    `Másold a képeket ide: ${photoDir}`,
    "",
    ...(input.photoTips ?? DEFAULT_PHOTO_TIPS).map((t) => `- [ ] ${t}`),
    "",
    "## 2. Hirdetések feladása",
    "",
    ...input.listings.map((l) => {
      const p = PLATFORMS.find((x) => x.id === l.platform);
      return `- [ ] **${p?.name ?? l.platform}** — nyisd meg: ${p?.postUrl ?? p?.url ?? ""}, illeszd be a \`${l.platform}.md\` szövegét, töltsd fel a fotókat, ár: ${formatHuf(l.priceHuf)}`;
    }),
    "",
    "## 3. Biztonság",
    "",
    "- [ ] Soha ne adj meg bankkártya-adatot 'a vevőnek' — az utaláshoz elég a számlaszám.",
    "- [ ] Gyanús a vevő, ha külföldi futárszolgálatra, előrefizetős linkre vagy e-mailes 'fizetési igazolásra' hivatkozik.",
    "- [ ] Személyes átvételnél forgalmas, nyilvános helyet válassz.",
    "- [ ] Utánvét (Foxpost/Packeta) a legbiztonságosabb távoli eladásnál.",
    "",
    "## 4. Eladás után",
    "",
    "- [ ] Vedd le a hirdetést az ÖSSZES platformról, ahol feladtad.",
    "",
  ];
  const checklistFile = path.join(dir, "CHECKLIST.md");
  await fs.writeFile(checklistFile, checklist.join("\n"), "utf8");
  files.push(checklistFile);

  // Machine-readable copy for the autopost CLI
  const jsonFile = path.join(dir, "listing.json");
  await fs.writeFile(
    jsonFile,
    JSON.stringify({ product: input.product, photosDir: "fotok", listings: input.listings }, null, 2),
    "utf8",
  );
  files.push(jsonFile);

  await fs.writeFile(
    path.join(photoDir, "IDE_MASOLD_A_KEPEKET.txt"),
    "Másold ebbe a mappába a termékfotókat, majd töltsd fel őket a hirdetésekhez.\n",
    "utf8",
  );

  return { dir, files };
}
