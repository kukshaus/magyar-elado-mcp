#!/usr/bin/env node
/**
 * magyar-elado-mcp — MCP server for selling on Hungarian marketplaces.
 *
 * Tools:
 *  - search_market_prices: live comparable prices from HardverApró + Jófogás
 *  - recommend_platforms:  ranked Hungarian platforms for a given product
 *  - create_listing_package: write paste-ready listings + photo folder + checklist
 *
 * Note: none of these platforms offer a public posting API, so publishing
 * is intentionally left to the user (copy-paste + photo upload).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  computeStats,
  hardveraproSearchUrl,
  jofogasSearchUrl,
  searchHardverapro,
  searchJofogas,
  type PriceHit,
} from "./research.js";
import { PLATFORMS, recommendPlatforms } from "./platforms.js";
import { writeListingPackage } from "./package.js";

const server = new McpServer({ name: "magyar-elado", version: "1.0.0" });

const json = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

server.registerTool(
  "search_market_prices",
  {
    title: "Piaci ár kutatás",
    description:
      "Search live listings on HardverApró and Jófogás for comparable prices of a product. " +
      "Returns hits per platform plus price statistics (median, quick-sale and patient price suggestions in HUF). " +
      "Use a specific query (brand + model, e.g. 'RTX 3070 8GB'). Hungarian market only.",
    inputSchema: {
      query: z.string().describe("Product search query, e.g. 'RTX 3070' or 'iPhone 13 128GB'"),
      limit: z.number().int().min(3).max(50).optional().describe("Max hits per platform (default 25)"),
    },
  },
  async ({ query, limit }) => {
    const max = limit ?? 25;
    const [ha, jf] = await Promise.allSettled([
      searchHardverapro(query, max),
      searchJofogas(query, max),
    ]);
    const hardverapro: PriceHit[] = ha.status === "fulfilled" ? ha.value : [];
    const jofogas: PriceHit[] = jf.status === "fulfilled" ? jf.value : [];
    const errors: string[] = [];
    if (ha.status === "rejected") errors.push(`hardverapro: ${ha.reason}`);
    if (jf.status === "rejected") errors.push(`jofogas: ${jf.reason}`);

    const all = [...hardverapro, ...jofogas];
    return json({
      query,
      searchUrls: {
        hardverapro: hardveraproSearchUrl(query),
        jofogas: jofogasSearchUrl(query),
      },
      stats: computeStats(query, all),
      hits: { hardverapro, jofogas },
      errors: errors.length ? errors : undefined,
      fallbackHint:
        all.length === 0
          ? "No hits — try a broader/differently spelled query, or research manually via the searchUrls above and arukereso.hu for new-price reference."
          : undefined,
    });
  },
);

server.registerTool(
  "recommend_platforms",
  {
    title: "Platform ajánlás",
    description:
      "Recommend the most relevant Hungarian selling platforms (HardverApró, Jófogás, Facebook Marketplace, " +
      "Vatera, Használtautó, Vinted) for a product, ranked with reasons, fees, posting URLs and title limits. " +
      "Pass the product description in Hungarian or English (Hungarian keywords match best, e.g. 'videokártya').",
    inputSchema: {
      product: z
        .string()
        .describe("Product description incl. category words, e.g. 'RTX 3070 videokártya gamer PC hardver'"),
      top: z.number().int().min(1).max(6).optional().describe("How many platforms to return (default 3)"),
    },
  },
  async ({ product, top }) => {
    const recs = recommendPlatforms(product).slice(0, top ?? 3);
    return json(
      recs.map((r) => ({
        id: r.platform.id,
        name: r.platform.name,
        score: r.score,
        reason: r.reason,
        postUrl: r.platform.postUrl,
        fees: r.platform.fees,
        titleLimit: r.platform.titleLimit,
        notes: r.platform.notes,
      })),
    );
  },
);

server.registerTool(
  "create_listing_package",
  {
    title: "Hirdetéscsomag mentése",
    description:
      "Write a ready-to-post listing package to disk: one paste-ready file per platform " +
      "(title, price, description, posting URL), a 'fotok' folder for the user's photos, and a posting checklist. " +
      "Returns the created directory and file paths. Listing texts should be in Hungarian.",
    inputSchema: {
      product: z.string().describe("Short product name, e.g. 'GeForce RTX 3070'"),
      outputDir: z
        .string()
        .optional()
        .describe("Target directory (default: ~/Elado/<date>-<product-slug>/)"),
      listings: z
        .array(
          z.object({
            platform: z
              .string()
              .describe(`Platform id: ${PLATFORMS.map((p) => p.id).join(" | ")}`),
            title: z.string().describe("Listing title (respect the platform's title limit)"),
            priceHuf: z.number().int().positive().describe("Asking price in HUF"),
            category: z.string().optional().describe("Suggested category on the platform"),
            description: z.string().describe("Full listing description in Hungarian"),
          }),
        )
        .min(1),
      photoTips: z
        .array(z.string())
        .optional()
        .describe("Product-specific photo tips to put on the checklist (Hungarian)"),
    },
  },
  async ({ product, outputDir, listings, photoTips }) => {
    const result = await writeListingPackage({ product, outputDir, listings, photoTips });
    return json({
      ...result,
      nextSteps:
        "Mondd el a felhasználónak: 1) másolja a fotókat a 'fotok' mappába, " +
        "2) nyissa meg a CHECKLIST.md-t és platformonként adja fel a hirdetést a kész szövegekkel.",
    });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
