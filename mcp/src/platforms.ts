/**
 * Registry of Hungarian selling platforms + category-based recommendation.
 */
export interface Platform {
  id: string;
  name: string;
  url: string;
  postUrl: string;
  audience: string;
  fees: string;
  bestFor: string[];
  titleLimit?: number;
  notes: string;
}

export const PLATFORMS: Platform[] = [
  {
    id: "hardverapro",
    name: "HardverApró",
    url: "https://hardverapro.hu",
    postUrl: "https://hardverapro.hu/muvelet/apro/felad.php",
    audience:
      "A legnagyobb magyar PC/tech közösség (Prohardver! csoport). A vevők értenek a hardverhez és ismerik a piaci árakat.",
    fees: "Ingyenes magánszemélyeknek; regisztráció és fórum-előélet növeli a bizalmat.",
    bestFor: [
      "videokártya", "gpu", "processzor", "cpu", "alaplap", "ram", "ssd", "hdd",
      "táp", "ház", "monitor", "laptop", "notebook", "pc", "számítógép", "gamer",
      "billentyűzet", "egér", "hardver", "nvidia", "rtx", "gtx", "radeon", "amd",
      "intel", "konzol", "playstation", "xbox", "nintendo", "telefon", "iphone",
      "samsung", "tablet", "okosóra", "router", "nas", "szerver", "fejhallgató",
    ],
    titleLimit: 60,
    notes:
      "Elvárás a pontos típusmegjelölés, az őszinte állapotleírás, garancia/számla megléte, " +
      "és jellemzően Foxpost/Packeta utánvét vagy személyes átvétel. Az irreálisan magas árat a közösség szóvá teszi.",
  },
  {
    id: "jofogas",
    name: "Jófogás",
    url: "https://www.jofogas.hu",
    postUrl: "https://www2.jofogas.hu/ai",
    audience: "A legnagyobb általános magyar apróhirdetési oldal, széles (nem szakmai) közönség.",
    fees: "Magánszemélyeknek kategóriától függően ingyenes vagy pár száz Ft/hirdetés; kiemelés fizetős.",
    bestFor: [
      "bútor", "háztartási gép", "ruha", "játék", "könyv", "sport", "kerékpár",
      "babakocsi", "gyerek", "kert", "szerszám", "műszaki", "elektronika",
      "telefon", "laptop", "tv", "hangszer", "állat", "lakás", "általános",
    ],
    titleLimit: 70,
    notes:
      "Széles közönség — a cím legyen kereshető (márka + típus + fő jellemző). " +
      "Beépített üzenetküldés és Foxpost/Packeta szállítási integráció van.",
  },
  {
    id: "facebook-marketplace",
    name: "Facebook Marketplace",
    url: "https://www.facebook.com/marketplace",
    postUrl: "https://www.facebook.com/marketplace/create/item",
    audience: "Hatalmas elérés, elsősorban helyi, személyes átvételes vevők. Sok alkudozó és no-show.",
    fees: "Ingyenes.",
    bestFor: [
      "bútor", "háztartási gép", "általános", "gyerek", "ruha", "sport",
      "kerékpár", "elektronika", "telefon", "tv", "kert", "autó", "nagy méretű",
    ],
    titleLimit: 99,
    notes:
      "Rövidebb, közvetlenebb szöveg működik. Érdemes releváns helyi csoportokba is bejelölni a hirdetést. " +
      "Óvakodj az előrefizetést/furcsa futárszolgálatot ajánló csaló vevőktől.",
  },
  {
    id: "vatera",
    name: "Vatera",
    url: "https://www.vatera.hu",
    postUrl: "https://www.vatera.hu/ertekesites",
    audience: "Aukciós + fix áras piactér; gyűjtői és ritkaság jellegű termékeknél erős.",
    fees: "Sikeres eladás után jutalék (kategóriafüggő, jellemzően ~5-10%); licitre is alkalmas.",
    bestFor: [
      "gyűjtemény", "régiség", "antik", "érme", "bélyeg", "kártya", "lego",
      "könyv", "hanglemez", "óra", "ékszer", "retró", "ritkaság",
    ],
    titleLimit: 60,
    notes:
      "Akkor éri meg, ha licitháborúra számítasz (ritkaság), vagy a Jófogás/FB nem hozott vevőt. A jutalékot áraz be.",
  },
  {
    id: "hasznaltauto",
    name: "Használtautó.hu",
    url: "https://www.hasznaltauto.hu",
    postUrl: "https://www.hasznaltauto.hu/hirdetesfeladas",
    audience: "A magyar használtautó-piac de facto központja.",
    fees: "Fizetős hirdetés (időtartam- és kategóriafüggő).",
    bestFor: ["autó", "gépkocsi", "motor", "motorkerékpár", "utánfutó", "teherautó", "jármű"],
    notes: "Járműnél kötelező kör; emellé FB Marketplace és Jófogás ingyen kiegészítő.",
  },
  {
    id: "vinted",
    name: "Vinted",
    url: "https://www.vinted.hu",
    postUrl: "https://www.vinted.hu/items/new",
    audience: "Ruha/divat fókuszú nemzetközi platform, Magyarországon is aktív, fiatalabb közönség.",
    fees: "Eladónak ingyenes (a vevő fizet védelmi díjat); integrált szállítás.",
    bestFor: ["ruha", "cipő", "táska", "divat", "márkás", "gyerekruha", "kiegészítő"],
    notes: "Ruhánál/cipőnél gyakran gyorsabb és kényelmesebb, mint a Jófogás; beépített csomagküldés.",
  },
];

export interface Recommendation {
  platform: Platform;
  score: number;
  reason: string;
}

/** Rank platforms for a product description / category keywords (Hungarian or English). */
export function recommendPlatforms(product: string): Recommendation[] {
  const text = product.toLowerCase();
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Word-start matching so e.g. "kártya" doesn't match inside "videokártya".
  const matches = (kw: string) => new RegExp(`(?:^|[\\s,;:.!?/()-])${escapeRe(kw)}`).test(text);
  const recs: Recommendation[] = PLATFORMS.map((p) => {
    const matched = p.bestFor.filter(matches);
    let score = matched.length * 10;
    // Generalists get a base score so there are always at least two venues.
    if (p.id === "jofogas") score += 8;
    if (p.id === "facebook-marketplace") score += 7;
    return {
      platform: p,
      score,
      reason:
        matched.length > 0
          ? `Kulcsszó találat: ${matched.slice(0, 5).join(", ")}. ${p.audience}`
          : p.audience,
    };
  });
  return recs.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}
