import { ProviderContext, Stream } from "../types";
import { getBaseUrl } from "../getBaseUrl";
import { commonHeaders } from "../headers";
import { throwProviderError } from "../providerErrors";
import { resolveRavokEmbed } from "../extractors/ravokExtractor";
import { parsePlyrData, createAbyssStreams } from "../extractors/abyssExtractor";
import { resolveDownloadLink } from "../extractors/megaExtractor";

export const getStream = async function ({
  link,
  type,
  signal,
  providerContext,
  isDownload,
}: {
  link: string;
  type: string;
  signal?: AbortSignal;
  providerContext: ProviderContext;
  isDownload?: boolean;
}): Promise<Stream[]> {
  try {
    const { axios, cheerio } = providerContext;
    const baseUrl = await getBaseUrl("animesalt", providerContext);
    const streams: Stream[] = [];

    // 1. If link is already a direct download or media file
    if (link.includes("trdownload=") || link.includes("mega.nz")) {
      const dlStream = await resolveDownloadLink(link, "1080p", "Multi-Audio", providerContext, signal);
      if (dlStream) return [dlStream];
    }

    if (/\.(m3u8|mp4|mkv)(\?.*)?$/i.test(link)) {
      return [
        {
          server: "Direct Stream",
          link,
          type: link.includes(".m3u8") ? "hls" : "mp4",
          quality: "1080p",
        },
      ];
    }

    // 2. Fetch the episode / movie page
    const fullUrl = link.startsWith("http") ? link : new URL(link, baseUrl).href;
    const res = await axios.get(fullUrl, {
      headers: {
        ...commonHeaders,
        Referer: baseUrl,
      },
      signal,
      timeout: 10000,
    });

    const html = typeof res.data === "string" ? res.data : "";
    const $ = cheerio.load(html);

    // 3. Find Ravok Buzz player iframe (Server 1)
    let ravokUrl = "";
    $("iframe").each((_: any, el: any) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (src.includes("ravok.buzz")) {
        ravokUrl = src;
      }
    });

    // Also check raw html for ravok link pattern
    if (!ravokUrl) {
      const ravokMatch = html.match(/https?:\/\/ravok\.buzz\/video\/[a-zA-Z0-9_-]+/i);
      if (ravokMatch) {
        ravokUrl = ravokMatch[0];
      }
    }

    if (ravokUrl) {
      try {
        const ravokStreams = await resolveRavokEmbed(ravokUrl, providerContext, signal);
        streams.push(...ravokStreams);
      } catch (err: any) {
        console.warn("[AnimeSalt:getStream] Ravok resolution warning:", err?.message);
      }
    }

    // 4. Find Plyr Player with base64 multi-language options (Server 2: Abyss)
    let plyrDataParam = "";
    $("iframe").each((_: any, el: any) => {
      const src = $(el).attr("src") || $(el).attr("data-src") || "";
      if (src.includes("player.php?data=")) {
        const dataMatch = src.match(/data=([^&"']+)/);
        if (dataMatch) {
          plyrDataParam = decodeURIComponent(dataMatch[1]);
        }
      }
    });

    if (!plyrDataParam) {
      const plyrMatch = html.match(/player\.php\?data=([^&"'\s]+)/);
      if (plyrMatch) {
        plyrDataParam = decodeURIComponent(plyrMatch[1]);
      }
    }

    if (plyrDataParam) {
      const langItems = parsePlyrData(plyrDataParam);
      if (langItems.length > 0) {
        const abyssStreams = createAbyssStreams(langItems);
        streams.push(...abyssStreams);
      }
    }

    // 5. Download table rows
    const dlPromises: Promise<Stream | null>[] = [];
    $("table tr").each((_: any, row: any) => {
      const $row = $(row);
      const rowText = $row.text().replace(/\s+/g, " ").trim();
      const aDl = $row.find("a[href*='trdownload']");
      const dlHref = aDl.attr("href");

      if (dlHref) {
        const quality =
          rowText.match(/\b(1080p|720p|480p|2160p|4k)\b/i)?.[0]?.toUpperCase() ||
          "HD";
        const lang =
          rowText.match(/Multi-Audio|Hindi|Tamil|Telugu|English|Japanese/i)?.[0] ||
          "Multi-Audio";

        const fullDlHref = dlHref.startsWith("http")
          ? dlHref
          : new URL(dlHref, baseUrl).href;

        dlPromises.push(
          resolveDownloadLink(fullDlHref, quality, lang, providerContext, signal),
        );
      }
    });

    if (dlPromises.length > 0) {
      const resolvedDls = await Promise.all(dlPromises);
      for (const s of resolvedDls) {
        if (s) streams.push(s);
      }
    }

    // 6. Deduplicate streams
    const uniqueStreams: Stream[] = [];
    const seenLinks = new Set<string>();

    for (const s of streams) {
      if (!seenLinks.has(s.link)) {
        seenLinks.add(s.link);
        uniqueStreams.push(s);
      }
    }

    return uniqueStreams;
  } catch (err) {
    throwProviderError("AnimeSalt", "getStream", err);
  }
};

