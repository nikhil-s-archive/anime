import animeIndex from "./anime_index.js";

import * as anikoto from "./anikoto.js";
import * as reanime from "./reanime.js";
import * as senshi from "./senshi.js";
import * as myronix from "./myronix.js";
import * as allwish from "./allwish.js";
import * as justanime from "./justanime.js";
import * as hianime from "./hianime.js";
import * as animeparadise from "./animeparadise.js";
import * as playbackdiag from "./playbackdiag.js";
import * as anipm from "./anipm.js";
import * as anidap from "./anidap.js";
import * as miruro from "./miruro.js";
import * as aniwave from "./aniwave.js";
import * as oneanime from "./oneanime.js";
import * as animeheaven from "./animeheaven.js";
import * as desidubanime from "./desidubanime.js";
import * as hindianime from "./hindianime.js";
import * as animesalt from "./animesalt.js";

const modules = {
  "animesalt.js": animesalt,
  "animesalt": animesalt,
  "hindianime.js": hindianime,
  "hindianime": hindianime,
  "desidubanime.js": desidubanime,
  "desidubanime": desidubanime,
  "anikoto.js": anikoto,
  "reanime.js": reanime,
  "senshi.js": senshi,
  "myronix.js": myronix,
  "allwish.js": allwish,
  "justanime.js": justanime,
  "hianime.js": hianime,
  "animeparadise.js": animeparadise,
  "playbackdiag.js": playbackdiag,
  "anipm.js": anipm,
  "anidap.js": anidap,
  "miruro.js": miruro,
  "aniwave.js": aniwave,
  "oneanime.js": oneanime,
  "animeheaven.js": animeheaven,
};

export const PLATFORMS = animeIndex;

export function getPlatforms() {
  return PLATFORMS.map((p) => ({
    id: p.id,
    name: p.name,
    baseUrl: p.baseUrl,
    iconUrl: p.iconUrl,
    lang: p.lang,
    version: p.version,
    isNsfw: p.isNsfw,
  }));
}

export function findPlatform(keyOrId) {
  if (!keyOrId) return PLATFORMS[0]; // Default to AniKoto

  const idNum = Number(keyOrId);
  if (!isNaN(idNum) && idNum !== 0) {
    const byId = PLATFORMS.find((p) => p.id === idNum);
    if (byId) return byId;
  }

  const normalized = String(keyOrId).trim().toLowerCase();
  const byName = PLATFORMS.find(
    (p) => p.name.toLowerCase() === normalized || p.name.toLowerCase().replace(/\s+/g, "") === normalized
  );
  if (byName) return byName;

  return PLATFORMS[0];
}

export function createPlatformExtension(keyOrId) {
  const platform = findPlatform(keyOrId);
  const fileName = (platform.sourceCodeUrl || "").split("/").pop();
  const mod = modules[fileName] || modules["anikoto.js"];

  if (!mod || !mod.DefaultExtension) {
    throw new Error(`Extension module not found for platform: ${platform.name}`);
  }

  const ext = new mod.DefaultExtension();
  ext.source = platform;
  return { ext, platform };
}
