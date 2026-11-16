import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourcesDir = path.join(__dirname, "..", "src", "sources");

const INDEX_URL =
  "https://raw.githubusercontent.com/Mallyd11/mangayomi-anime-extensions/main/anime_index.json";

async function sync() {
  console.log(`[sync] Fetching anime index from ${INDEX_URL}...`);
  const res = await fetch(INDEX_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching index`);
  const index = await res.json();
  console.log(`[sync] Found ${index.length} platforms in index.`);

  if (!fs.existsSync(sourcesDir)) {
    fs.mkdirSync(sourcesDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(sourcesDir, "anime_index.json"),
    JSON.stringify(index, null, 2)
  );
  fs.writeFileSync(
    path.join(sourcesDir, "anime_index.js"),
    `export default ${JSON.stringify(index, null, 2)};\n`
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
