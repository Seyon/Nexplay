export * from "./catalog";
export * from "./posts";
export * from "./meta";
export * from "./episodes";
export * from "./stream";
export * from "./AnimeSaltProvider";

// Alias exports for casing compatibility
import { getPosts, getSearchPosts } from "./posts";
import { getMeta } from "./meta";
import { getEpisodes } from "./episodes";
import { getStream } from "./stream";
import { AnimeSaltProvider } from "./AnimeSaltProvider";

export const GetHomePosts = getPosts;
export const GetSearchPosts = getSearchPosts;
export const GetMetaData = getMeta;
export const GetEpisodeLinks = getEpisodes;
export const GetStream = getStream;

export const provider = new AnimeSaltProvider();
export default provider;
