import { EpisodeLink, ProviderContext } from "../types";
import { getBaseUrl } from "../getBaseUrl";
import { commonHeaders } from "../headers";
import { throwProviderError } from "../providerErrors";

const DEFAULT_POSTER =
  "https://animesalt.cx/wp-content/uploads/cropped-AnimeSalticon-192x192.png";

function normalizeImageUrl(src?: string): string {
  if (!src) return DEFAULT_POSTER;
  let url = src.trim();
  if (url.startsWith("//")) {
    url = `https:${url}`;
  } else if (url.startsWith("/")) {
    url = `https://animesalt.cx${url}`;
  }
  return url;
}

export const getEpisodes = async function ({
  url,
  providerContext,
}: {
  url: string;
  providerContext: ProviderContext;
}): Promise<EpisodeLink[]> {
  try {
    const { axios, cheerio } = providerContext;
    const baseUrl = await getBaseUrl("animesalt", providerContext);

    const isAjaxSeason = url.includes("action=action_select_season");
    const targetUrl = url.startsWith("http") ? url : new URL(url, baseUrl).href;

    const res = await axios.get(targetUrl, {
      headers: {
        ...commonHeaders,
        Referer: baseUrl,
        "X-Requested-With": isAjaxSeason ? "XMLHttpRequest" : undefined,
      },
      timeout: 10000,
    });

    const html = typeof res.data === "string" ? res.data : "";
    const $ = cheerio.load(html);
    const episodes: EpisodeLink[] = [];

    // Parse all episode articles
    $("article.episodes, .post.episodes").each((_: any, el: any) => {
      const $el = $(el);
      const numEpi = $el.find(".num-epi").text().trim();
      const rawTitle = $el.find(".entry-title").text().trim();
      const linkHref =
        $el.find("a.lnk-blk").attr("href") ||
        $el.find("a").first().attr("href") ||
        "";

      if (!linkHref) return;

      const fullLink = linkHref.startsWith("http")
        ? linkHref
        : new URL(linkHref, baseUrl).href;

      const $img = $el.find("img");
      const rawImg =
        $img.attr("data-src") ||
        $img.attr("data-lazy-src") ||
        $img.attr("src") ||
        "";

      const image = normalizeImageUrl(rawImg);

      let cleanTitle = rawTitle;
      if (numEpi && !cleanTitle.includes(numEpi)) {
        cleanTitle = `Episode ${numEpi}${rawTitle ? ` - ${rawTitle}` : ""}`;
      } else if (!cleanTitle) {
        cleanTitle = `Episode ${numEpi || episodes.length + 1}`;
      }

      episodes.push({
        title: cleanTitle,
        link: fullLink,
        image,
      });
    });

    // Fallback: if no article.episodes, find any a[href*="/episode/"]
    if (episodes.length === 0) {
      const seen = new Set<string>();
      $('a[href*="/episode/"]').each((_: any, aEl: any) => {
        const href = $(aEl).attr("href");
        if (!href || seen.has(href)) return;
        seen.add(href);

        const fullLink = href.startsWith("http") ? href : new URL(href, baseUrl).href;
        const text = $(aEl).text().replace(/\s+/g, " ").trim() || `Episode ${episodes.length + 1}`;

        episodes.push({
          title: text,
          link: fullLink,
        });
      });
    }

    return episodes;
  } catch (err) {
    throwProviderError("AnimeSalt", "getEpisodes", err);
  }
};

