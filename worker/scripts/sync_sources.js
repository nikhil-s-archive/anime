import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourcesDir = path.join(__dirname, "..", "src", "sources");

const INDEX_URL =
  "https://raw.githubusercontent.com/Mallyd11/mangayomi-anime-extensions/main/anime_index.json";

const CUSTOM_SOURCES = [
  {
    name: "DesiDubAnime",
    id: 1827465920,
    baseUrl: "https://www.desidubanime.me",
    lang: "hi",
    typeSource: "single",
    iconUrl: "https://www.desidubanime.me/wp-content/uploads/2025/01/Logoo.png",
    dateFormat: "",
    dateFormatLocale: "",
    isNsfw: false,
    hasCloudflare: false,
    sourceCodeUrl: "https://raw.githubusercontent.com/Mallyd11/mangayomi-anime-extensions/refs/heads/main/javascript/anime/src/all/desidubanime.js",
    apiUrl: "https://www.desidubanime.me/wp-json",
    version: "1.0.0",
    isManga: false,
    itemType: 1,
    isFullData: false,
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes: "Indian regional dubbed anime streaming platform (Hindi, Tamil, Telugu, Malayalam, Bengali, etc.)",
  },
];

async function sync() {
  console.log(`[sync] Fetching anime index from ${INDEX_URL}...`);
  const res = await fetch(INDEX_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching index`);
  const index = await res.json();
  console.log(`[sync] Found ${index.length} platforms in index.`);

  if (!fs.existsSync(sourcesDir)) {
    fs.mkdirSync(sourcesDir, { recursive: true });
  }

  const combinedIndex = [
    ...CUSTOM_SOURCES,
    ...index.filter((p) => !CUSTOM_SOURCES.some((c) => c.name.toLowerCase() === p.name.toLowerCase())),
  ];

  fs.writeFileSync(
    path.join(sourcesDir, "anime_index.json"),
    JSON.stringify(combinedIndex, null, 2)
  );
  fs.writeFileSync(
    path.join(sourcesDir, "anime_index.js"),
    `export default ${JSON.stringify(combinedIndex, null, 2)};\n`
  );

  const seenUrls = new Set();
  for (const item of index) {
    const url = item.sourceCodeUrl;
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);

    const fn = path.basename(url);
    console.log(`[sync] Downloading ${fn} from ${url}...`);
    try {
      const srcRes = await fetch(url);
      if (!srcRes.ok) {
        console.error(`[sync] Failed to fetch ${url} (HTTP ${srcRes.status})`);
        continue;
      }
      let content = await srcRes.text();

      const importHeader = `import { MProvider, Client, Document, SharedPreferences } from "../runtime.js";\n`;
      const exportFooter = `\nexport { mangayomiSources, DefaultExtension };\n`;

      if (!content.includes(`from "../runtime.js"`)) {
        content = importHeader + content;
      }
      if (!content.includes(`export { mangayomiSources, DefaultExtension }`)) {
        content = content + exportFooter;
      }

      fs.writeFileSync(path.join(sourcesDir, fn), content);
      console.log(`[sync] Successfully saved and wrapped ${fn} (${content.length} bytes).`);
    } catch (e) {
      console.error(`[sync] Error downloading ${fn}:`, e.message);
    }
  }

  console.log("[sync] All extensions synchronized successfully.");
}

sync().catch((err) => {
  console.error("[sync] Fatal error:", err);
  process.exit(1);
});
