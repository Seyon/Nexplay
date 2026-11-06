import { Info, Link, ProviderContext } from "../types";
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

export const getMeta = async function ({
  link,
  providerContext,
}: {
  link: string;
  providerContext: ProviderContext;
}): Promise<Info> {
  try {
    const { axios, cheerio } = providerContext;
    const baseUrl = await getBaseUrl("animesalt", providerContext);
    const fullUrl = link.startsWith("http") ? link : new URL(link, baseUrl).href;

    const res = await axios.get(fullUrl, {
      headers: commonHeaders,
      timeout: 10000,
    });

    const html = typeof res.data === "string" ? res.data : "";
    const $ = cheerio.load(html);

    const isSeries =
      fullUrl.includes("/series/") ||
      $("body").hasClass("single-series") ||
      $("#episode_by_temp").length > 0 ||
      $(".season-btn").length > 0;

    // Accurate title extraction from title tag or main header
    const pageTitle = $("title").text().replace(/ - Anime Salt.*/i, "").trim();
    const rawTitle =
      pageTitle ||
      $("header h1, .m-title, h1").not(".episodes h1, .episodes *").first().text().trim() ||
      $(".entry-title").first().text().trim();

    // Image / Poster extraction
    let image = "";
    // Check script variable let image = "...";
    const scriptImgMatch = html.match(/let\s+image\s*=\s*["']([^"']+)["']/i);
    if (scriptImgMatch && scriptImgMatch[1]) {
      image = normalizeImageUrl(scriptImgMatch[1]);
    }

    if (!image) {
      // Find TMDB poster image first
      const tmdbImg = $('img[data-src*="image.tmdb.org"], img[src*="image.tmdb.org"]')
        .not(".custom-logo-link img")
        .first();
      const rawTmdb = tmdbImg.attr("data-src") || tmdbImg.attr("src");
      if (rawTmdb) {
        image = normalizeImageUrl(rawTmdb);
      }
    }

    if (!image) {
      const imgEl =
        $(".post-thumbnail figure img, .poster img, .entry-header img")
          .first();
      const rawSrc =
        imgEl.attr("data-src") ||
        imgEl.attr("data-lazy-src") ||
        imgEl.attr("src");
      image = normalizeImageUrl(rawSrc);
    }

    // Synopsis extraction
    let synopsis =
      $("#overview-text").text().replace(/\s+/g, " ").trim() ||
      $(".sinopsis").text().replace(/\s+/g, " ").trim() ||
      $(".entry-content p").first().text().replace(/\s+/g, " ").trim() ||
      $(".description").text().replace(/\s+/g, " ").trim();

    // Clean synopsis
    synopsis = synopsis.replace(/^Overview\s+/i, "").replace(/Read More$/i, "").trim();

    // Tags & Taxonomies
    const tags: string[] = [];
    $('a[href*="/genre/"], a[href*="/category/genre/"]').each((_: any, el: any) => {
      const g = $(el).text().trim();
      if (g && !tags.includes(g)) tags.push(g);
    });

    $('a[href*="/language/"], a[href*="/category/language/"]').each((_: any, el: any) => {
      const l = $(el).text().trim();
      if (l && !tags.includes(l)) tags.push(`${l} Dub`);
    });

    $('a[href*="/network/"], a[href*="/category/network/"]').each((_: any, el: any) => {
      const net = $(el).text().trim();
      if (net && !tags.includes(net)) tags.push(net);
    });

    // Rating / Year
    const ratingMatch = html.match(/ratingValue["']?\s*:\s*["']?([\d.]+)/i);

    const linkList: Link[] = [];

    if (isSeries) {
      // Find all seasons
      const seasonBtns = $("a.season-btn");

      if (seasonBtns.length > 0) {
        seasonBtns.each((_: any, btnEl: any) => {
          const $btn = $(btnEl);
          const seasonNum = $btn.attr("data-season") || "1";
          const postId = $btn.attr("data-post") || "";
          const btnText = $btn.text().replace(/\s+/g, " ").trim();
          const cleanSeasonTitle = btnText || `Season ${seasonNum}`;

          const episodesAjaxUrl = postId
            ? `${baseUrl}/wp-admin/admin-ajax.php?action=action_select_season&season=${encodeURIComponent(
                seasonNum,
              )}&post=${encodeURIComponent(postId)}`
            : `${fullUrl}#season-${seasonNum}`;

          linkList.push({
            title: cleanSeasonTitle,
            episodesLink: episodesAjaxUrl,
          });
        });
      } else {
        // Single season series
        linkList.push({
          title: "Season 1",
          episodesLink: fullUrl,
        });
      }
    } else {
      // Movie Link with direct download mirrors and direct stream
      const directLinks: Link["directLinks"] = [
        {
          title: "Stream (Master Player)",
          link: fullUrl,
          type: "movie",
        },
      ];

      // Parse download table rows
      $("table tr").each((_: any, row: any) => {
        const rowText = $(row).text().replace(/\s+/g, " ").trim();
        const dlLink = $(row).find("a[href*='trdownload']").attr("href");
        if (dlLink) {
          const quality =
            rowText.match(/\b(1080p|720p|480p|2160p|4k)\b/i)?.[0]?.toUpperCase() ||
            "HD";
          const serverName = rowText.match(/Mega|Google|Drive/i)?.[0] || "Download";
          const lang = rowText.match(/Multi-Audio|Hindi|Tamil|Telugu|English|Japanese/i)?.[0] || "";

          directLinks.push({
            title: `${serverName} ${quality} ${lang ? `(${lang})` : ""}`.trim(),
            link: dlLink.startsWith("http") ? dlLink : new URL(dlLink, baseUrl).href,
            type: "movie",
          });
        }
      });

      linkList.push({
        title: rawTitle,
        quality: "1080p",
        directLinks,
      });
    }

    return {
      title: rawTitle,
      image,
      poster: image,
      synopsis: synopsis || `${rawTitle} - Watch now on AnimeSalt.`,
      type: isSeries ? "series" : "movie",
      tags: tags.length > 0 ? tags : ["Anime", "Multi-Audio"],
      rating: ratingMatch ? ratingMatch[1] : undefined,
      linkList,
      webUrl: fullUrl,
    };
  } catch (err) {
    throwProviderError("AnimeSalt", "getMeta", err);
  }
};
