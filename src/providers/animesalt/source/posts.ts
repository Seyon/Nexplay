import { Post, ProviderContext } from "../types";
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

function parsePostElements($: any, baseUrl: string): Post[] {
  const posts: Post[] = [];
  const seenLinks = new Set<string>();

  $("article.post, article.movies, article.series, .post-item").each((_: any, el: any) => {
    const $el = $(el);

    // Skip episode articles if this happens on a series page
    if ($el.hasClass("episodes") && $el.closest("#episode_by_temp").length > 0) {
      return;
    }

    const title =
      $el.find(".entry-title").text().trim() ||
      $el.find("h2").text().trim() ||
      $el.find("h3").text().trim();

    const linkHref =
      $el.find("a.lnk-blk").attr("href") ||
      $el.find("a").first().attr("href") ||
      "";

    if (!title || !linkHref) return;

    let fullLink = linkHref.startsWith("http")
      ? linkHref
      : new URL(linkHref, baseUrl).href;

    if (seenLinks.has(fullLink)) return;
    seenLinks.add(fullLink);

    // Image extraction
    const $img = $el.find("img");
    const rawImg =
      $img.attr("data-src") ||
      $img.attr("data-lazy-src") ||
      $img.attr("src") ||
      "";

    const image = normalizeImageUrl(rawImg);

    // Badges / Tags
    const tag = $el.find(".post-ql").text().trim() || undefined;
    const cornerTag = $el.find(".year").text().trim() || undefined;

    posts.push({
      title,
      link: fullLink,
      image,
      provider: "animesalt",
      tag,
      cornerTag,
    });
  });

  return posts;
}

export const getPosts = async function ({
  filter,
  page,
  providerValue,
  signal,
  providerContext,
}: {
  filter: string;
  page: number;
  providerValue: string;
  providerContext: ProviderContext;
  signal: AbortSignal;
}): Promise<Post[]> {
  try {
    const { axios, cheerio } = providerContext;
    const baseUrl = await getBaseUrl(providerValue || "animesalt", providerContext);

    let targetUrl: string;

    if (!filter) {
      targetUrl = page === 1 ? `${baseUrl}/` : `${baseUrl}/page/${page}/`;
    } else {
      const cleanFilter = filter.trim();
      const hasQuery = cleanFilter.includes("?");

      if (hasQuery) {
        const [pathPart, queryPart] = cleanFilter.split("?");
        const cleanPath = pathPart.replace(/\/+$/, "");
        targetUrl =
          page === 1
            ? `${baseUrl}${cleanPath}/?${queryPart}`
            : `${baseUrl}${cleanPath}/page/${page}/?${queryPart}`;
      } else {
        const cleanPath = cleanFilter.replace(/\/+$/, "");
        targetUrl =
          page === 1 ? `${baseUrl}${cleanPath}/` : `${baseUrl}${cleanPath}/page/${page}/`;
      }
    }

    const res = await axios.get(targetUrl, {
      headers: commonHeaders,
      signal,
      timeout: 10000,
    });

    const $ = cheerio.load(res.data);
    return parsePostElements($, baseUrl);
  } catch (err) {
    throwProviderError("AnimeSalt", "getPosts", err);
  }
};

export const getSearchPosts = async function ({
  searchQuery,
  page,
  providerValue,
  signal,
  providerContext,
}: {
  searchQuery: string;
  page: number;
  providerValue: string;
  providerContext: ProviderContext;
  signal: AbortSignal;
}): Promise<Post[]> {
  try {
    const { axios, cheerio } = providerContext;
    const baseUrl = await getBaseUrl(providerValue || "animesalt", providerContext);

    const targetUrl =
      page === 1
        ? `${baseUrl}/?s=${encodeURIComponent(searchQuery)}`
        : `${baseUrl}/page/${page}/?s=${encodeURIComponent(searchQuery)}`;

    const res = await axios.get(targetUrl, {
      headers: commonHeaders,
      signal,
      timeout: 10000,
    });

    const $ = cheerio.load(res.data);
    return parsePostElements($, baseUrl);
  } catch (err) {
    throwProviderError("AnimeSalt", "getSearchPosts", err);
  }
};

