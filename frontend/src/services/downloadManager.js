/**
 * downloadManager.js — Background download queue and processor for AnimeX.
 *
 * Downloads HLS stream segments and subtitle tracks concurrently,
 * aggregates progress, and stores the resulting Blobs into IndexedDB (localDb).
 */

import { saveDownload, deleteDownload, getAllDownloads } from "./localDb.js";

class DownloadManager {
  constructor() {
    this.queue = []; // Active or recently finished tasks
    this.listeners = new Set();
    this.maxConcurrentChunks = 6;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch (err) {
        console.error("DownloadManager subscriber error:", err);
      }
    });
  }

  getSnapshot() {
    return this.queue.map((t) => ({
      id: t.id,
      title: t.title,
      animeTitle: t.animeTitle,
      episodeTitle: t.episodeTitle,
      episodeNumber: t.episodeNumber,
      thumbnail: t.thumbnail,
      platform: t.platform,
      quality: t.quality,
      audioType: t.audioType,
      status: t.status, // "queued" | "downloading" | "completed" | "error" | "cancelled"
      progress: t.progress, // 0 - 100
      completedChunks: t.completedChunks,
      totalChunks: t.totalChunks,
      bytesDownloaded: t.bytesDownloaded,
      speed: t.speed,
      error: t.error,
      createdAt: t.createdAt,
    }));
  }

  getActiveCount() {
    return this.queue.filter(
      (t) => t.status === "downloading" || t.status === "queued"
    ).length;
  }

  /**
   * Start or queue an episode download.
   */
  async startDownload({
    streamUrl,
    animeTitle = "Anime",
    episodeTitle = "Episode",
    episodeNumber = 1,
    thumbnail = "",
    platform = "AnimeX",
    quality = "Default",
    audioType = "sub",
    subtitles = [],
  }) {
    if (!streamUrl) {
      throw new Error("Missing streamUrl for download");
    }

    // Check if duplicate task is already active
    const existing = this.queue.find(
      (t) =>
        t.streamUrl === streamUrl &&
        (t.status === "downloading" || t.status === "queued")
    );
    if (existing) return existing.id;

    const id = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const abortController = new AbortController();

    const task = {
      id,
      streamUrl,
      title: `${animeTitle} - ${episodeTitle}`,
      animeTitle,
      episodeTitle,
      episodeNumber,
      thumbnail,
      platform,
      quality,
      audioType,
      subtitles: Array.isArray(subtitles) ? [...subtitles] : [],
      status: "queued",
      progress: 0,
      completedChunks: 0,
      totalChunks: 1,
      bytesDownloaded: 0,
      speed: "0 KB/s",
      error: null,
      abortController,
      createdAt: Date.now(),
    };

    this.queue.unshift(task);
    this.notify();

    // Start executing the download asynchronously
    this._processTask(task);
    return id;
  }

  /**
   * Cancel an active or queued download.
   */
  cancelDownload(id) {
    const task = this.queue.find((t) => t.id === id);
    if (task) {
      if (task.abortController) {
        task.abortController.abort();
      }
      task.status = "cancelled";
      this.notify();
      // Remove cancelled tasks after 2 seconds
      setTimeout(() => {
        this.queue = this.queue.filter((t) => t.id !== id);
        this.notify();
      }, 2000);
    }
  }

  /**
   * Remove a completed/error task from the queue list.
   */
  dismissTask(id) {
    this.queue = this.queue.filter((t) => t.id !== id);
    this.notify();
  }

  /**
   * Internal processor for a single task.
   */
  async _processTask(task) {
    task.status = "downloading";
    this.notify();

    const signal = task.abortController.signal;
    let startTime = Date.now();
    let bytesSinceLastCheck = 0;
    let lastSpeedTime = Date.now();

    try {
      // 1. Fetch thumbnail as Blob so it works completely offline
      let thumbnailBlob = null;
      if (task.thumbnail && task.thumbnail.startsWith("http")) {
        try {
          const tRes = await fetch(task.thumbnail, { signal });
          if (tRes.ok) thumbnailBlob = await tRes.blob();
        } catch (_) {}
      }

      // 2. Fetch subtitle texts in parallel so they are saved offline
      const savedSubtitles = [];
      if (task.subtitles && task.subtitles.length > 0) {
        await Promise.all(
          task.subtitles.map(async (sub) => {
            try {
              let text = sub.content || "";
              if (!text && (sub.proxyUrl || sub.url)) {
                const subRes = await fetch(sub.proxyUrl || sub.url, { signal });
                if (subRes.ok) text = await subRes.text();
              }
              if (text && text.trim().length > 0) {
                savedSubtitles.push({
                  label: sub.label || sub.name || "English",
                  lang: sub.lang || "en",
                  content: text,
                  default: Boolean(sub.default),
                });
              }
            } catch (_) {}
          })
        );
      }

      const isDirectMp4 =
        task.streamUrl.toLowerCase().includes(".mp4") &&
        !task.streamUrl.includes(".m3u8");

      if (isDirectMp4) {
        // Direct MP4 download
        const res = await fetch(task.streamUrl, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
        const reader = res.body?.getReader();

        let chunks = [];
        let received = 0;

        if (reader) {
          while (true) {
            if (signal.aborted) throw new Error("Download aborted");
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            task.bytesDownloaded = received;

            if (contentLength > 0) {
              task.progress = Math.min(99, Math.round((received / contentLength) * 100));
            }

            const now = Date.now();
            if (now - lastSpeedTime >= 800) {
              const diffSec = (now - lastSpeedTime) / 1000;
              const speedBytes = (received - bytesSinceLastCheck) / diffSec;
              task.speed = formatSpeed(speedBytes);
              bytesSinceLastCheck = received;
              lastSpeedTime = now;
              this.notify();
            }
          }
        } else {
          const blob = await res.blob();
          chunks = [await blob.arrayBuffer()];
          received = blob.size;
        }

        const videoBlob = new Blob(chunks, { type: "video/mp4" });

        // Save to IndexedDB
        await saveDownload({
          id: task.id,
          animeTitle: task.animeTitle,
          episodeTitle: task.episodeTitle,
          episodeNumber: task.episodeNumber,
          platform: task.platform,
          thumbnail: task.thumbnail,
          thumbnailBlob,
          quality: task.quality,
          audioType: task.audioType,
          isHls: false,
          videoBlob,
          subtitles: savedSubtitles,
          totalSize: received,
          createdAt: Date.now(),
        });
      } else {
        // HLS Stream Download (.m3u8)
        const res = await fetch(task.streamUrl, { signal });
        if (!res.ok) throw new Error(`Playlist fetch failed: HTTP ${res.status}`);
        const manifestText = await res.text();

        let playlistUrl = task.streamUrl;
        let lines = manifestText
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);

        // If master playlist, select the matching audio variant or highest bandwidth
        const isMaster = lines.some((l) => l.startsWith("#EXT-X-STREAM-INF"));
        if (isMaster) {
          let bestVariantUrl = null;
          let maxBandwidth = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
              const bwMatch = lines[i].match(/BANDWIDTH=(\d+)/);
              const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
              const nextLine = lines[i + 1];
              if (nextLine && !nextLine.startsWith("#")) {
                if (bw > maxBandwidth) {
                  maxBandwidth = bw;
                  bestVariantUrl = nextLine;
                }
              }
            }
          }
          if (bestVariantUrl) {
            playlistUrl = new URL(bestVariantUrl, task.streamUrl).href;
            const subRes = await fetch(playlistUrl, { signal });
            if (!subRes.ok) throw new Error(`Variant fetch failed: HTTP ${subRes.status}`);
            const subText = await subRes.text();
            lines = subText
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean);
          }
        }

        // Parse segment URLs and durations
        const segmentUrls = [];
        const segmentDurations = [];
        let currentDuration = 4.0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith("#EXTINF:")) {
            const durMatch = line.match(/#EXTINF:([\d.]+)/);
            if (durMatch) currentDuration = parseFloat(durMatch[1]) || 4.0;
          } else if (!line.startsWith("#")) {
            try {
              const abs = new URL(line, playlistUrl).href;
              segmentUrls.push(abs);
              segmentDurations.push(currentDuration);
            } catch (_) {}
          }
        }

        if (segmentUrls.length === 0) {
          throw new Error("No video segments found in stream playlist.");
        }

        const total = segmentUrls.length;
        task.totalChunks = total;
        task.completedChunks = 0;
        this.notify();

        const chunks = new Array(total);
        let activeIdx = 0;
        let totalBytes = 0;

        const downloadWorker = async () => {
          while (activeIdx < total) {
            if (signal.aborted) throw new Error("Download aborted");
            const idx = activeIdx++;
            const segUrl = segmentUrls[idx];

            let segRes;
            let retries = 3;
            while (retries >= 0) {
              try {
                segRes = await fetch(segUrl, { signal });
                if (segRes.ok) break;
              } catch (e) {
                if (signal.aborted) throw e;
              }
              retries--;
              if (retries < 0) {
                throw new Error(`Failed to download segment ${idx + 1}`);
              }
              await new Promise((r) => setTimeout(r, 400));
            }

            const buf = await segRes.arrayBuffer();
            const chunkBlob = new Blob([buf], { type: "video/mp2t" });
            chunks[idx] = chunkBlob;
            totalBytes += buf.byteLength;

            task.completedChunks++;
            task.bytesDownloaded = totalBytes;
            task.progress = Math.min(99, Math.round((task.completedChunks / total) * 100));

            const now = Date.now();
            if (now - lastSpeedTime >= 600) {
              const diffSec = (now - lastSpeedTime) / 1000;
              const speedBytes = (totalBytes - bytesSinceLastCheck) / diffSec;
              task.speed = formatSpeed(speedBytes);
              bytesSinceLastCheck = totalBytes;
              lastSpeedTime = now;
              this.notify();
            }
          }
        };

        const concurrency = Math.min(this.maxConcurrentChunks, total);
        await Promise.all(
          Array.from({ length: concurrency }, () => downloadWorker())
        );

        const totalDuration = segmentDurations.reduce((a, b) => a + b, 0);

        // Save to IndexedDB
        await saveDownload({
          id: task.id,
          animeTitle: task.animeTitle,
          episodeTitle: task.episodeTitle,
          episodeNumber: task.episodeNumber,
          platform: task.platform,
          thumbnail: task.thumbnail,
          thumbnailBlob,
          quality: task.quality,
          audioType: task.audioType,
          isHls: true,
          segments: chunks, // array of Blobs
          segmentDurations,
          duration: totalDuration,
          subtitles: savedSubtitles,
          totalSize: totalBytes,
          createdAt: Date.now(),
        });
      }

      task.progress = 100;
      task.status = "completed";
      task.speed = "Done";
      this.notify();

      // Automatically remove completed item from the active queue after 3 seconds
      setTimeout(() => {
        this.dismissTask(task.id);
      }, 3000);
    } catch (err) {
      if (signal.aborted || err.message === "Download aborted") {
        task.status = "cancelled";
      } else {
        console.error("[DownloadManager error]:", err);
        task.status = "error";
        task.error = err.message || "Download failed";
      }
      this.notify();
    }
  }

  /**
   * Export / save a downloaded episode to the user's computer/device disk.
   */
  async saveToDevice(downloadItem) {
    if (!downloadItem) return;

    let videoBlob;
    let extension = "ts";

    if (downloadItem.isHls && Array.isArray(downloadItem.segments)) {
      videoBlob = new Blob(downloadItem.segments, { type: "video/mp2t" });
      extension = "ts";
    } else if (downloadItem.videoBlob) {
      videoBlob = downloadItem.videoBlob;
      extension = "mp4";
    } else {
      throw new Error("No video data found in item");
    }

    const safeTitle = (downloadItem.animeTitle || "anime")
      .replace(/[/\\?%*:|"<>]/g, "-")
      .trim();
    const safeEpisode = (downloadItem.episodeTitle || "episode")
      .replace(/[/\\?%*:|"<>]/g, "-")
      .trim();
    const cleanQuality = downloadItem.quality
      ? `-${downloadItem.quality.replace(/[/\\?%*:|"<>]/g, "_")}`
      : "";

    const filename = `${safeTitle} - ${safeEpisode}${cleanQuality}.${extension}`;

    const url = URL.createObjectURL(videoBlob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 5000);

    // Also download primary subtitle if available
    if (downloadItem.subtitles && downloadItem.subtitles.length > 0) {
      this.saveSubtitleToDevice(downloadItem, 0, `${safeTitle} - ${safeEpisode}${cleanQuality}`);
    }
  }

  /**
   * Export / save a subtitle file (.srt) to device.
   */
  saveSubtitleToDevice(downloadItem, subIndex = 0, baseName = "") {
    if (
      !downloadItem ||
      !downloadItem.subtitles ||
      !downloadItem.subtitles[subIndex]
    )
      return;

    const sub = downloadItem.subtitles[subIndex];
    const srtContent = vttToSrt(sub.content || "");
    const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const safeName =
      baseName ||
      `${downloadItem.animeTitle} - ${downloadItem.episodeTitle}`.replace(
        /[/\\?%*:|"<>]/g,
        "-"
      );

    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = `${safeName}.${sub.lang || "en"}.srt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 5000);
  }
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return "0 KB/s";
  if (bytesPerSec < 1024 * 1024) {
    return `${Math.round(bytesPerSec / 1024)} KB/s`;
  }
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function vttToSrt(vttText) {
  if (!vttText) return "";
  let cleaned = vttText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  cleaned = cleaned.replace(/^WEBVTT[^\n]*\n+/i, "");
  cleaned = cleaned.replace(/(STYLE|REGION|NOTE)\s*[\s\S]*?(?=\n\n|\n$|$)/gi, "");

  const rawBlocks = cleaned.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
  const srtBlocks = [];
  let counter = 1;

  for (const block of rawBlocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const timeLineIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeLineIdx === -1) continue;

    let timeLine = lines[timeLineIdx];
    timeLine = timeLine.replace(/\s+(line|position|align|size):[^\s]+/gi, "");
    timeLine = timeLine.replace(
      /(\d{1,2}:)?(\d{2}):(\d{2})\.(\d{3})/g,
      (match, hh, mm, ss, ms) => {
        const hours = hh ? hh.replace(":", "").padStart(2, "0") : "00";
        return `${hours}:${mm}:${ss},${ms}`;
      }
    );

    const textLines = lines
      .slice(timeLineIdx + 1)
      .map((tl) => tl.replace(/<\/?[^>]+(>|$)/g, "").trim())
      .filter(Boolean);

    if (textLines.length === 0) continue;
    srtBlocks.push(`${counter++}\n${timeLine}\n${textLines.join("\n")}`);
  }

  return srtBlocks.join("\n\n");
}

export const downloadManager = new DownloadManager();
