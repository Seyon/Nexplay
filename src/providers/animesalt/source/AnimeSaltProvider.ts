import axios, { AxiosStatic } from "axios";
import * as cheerio from "cheerio";
import {
  Post,
  Info,
  EpisodeLink,
  Stream,
  Catalog,
  ProviderType,
  ProviderContext,
} from "../types";
import { catalog, genres } from "./catalog";
import { getPosts, getSearchPosts } from "./posts";
import { getMeta } from "./meta";
import { getEpisodes } from "./episodes";
import { getStream } from "./stream";
import { commonHeaders } from "../headers";

export class AnimeSaltProvider implements ProviderType {
  public id = "animesalt";
  public name = "AnimeSalt (First Anime Provider)";
  public version = "1.0.0";
  public catalog: Catalog[] = catalog;
  public genres: Catalog[] = genres;
  public defaultBaseUrl = "https://animesalt.cx";

  private defaultContext: ProviderContext = {
    axios: axios as AxiosStatic,
    cheerio: cheerio as any,
    commonHeaders,
  };

  constructor(private context?: Partial<ProviderContext>) {
    if (context) {
      this.defaultContext = {
        ...this.defaultContext,
        ...context,
      };
    }
  }

  private getContext(provided?: ProviderContext): ProviderContext {
    return provided || this.defaultContext;
  }

  // Vega Provider Interface
  public GetHomePosts = async ({
    filter,
    page,
    providerValue,
    signal,
    providerContext,
  }: {
    filter: string;
    page: number;
    providerValue: string;
    signal: AbortSignal;
    providerContext: ProviderContext;
  }): Promise<Post[]> => {
    return getPosts({
      filter,
      page,
      providerValue: providerValue || this.id,
      signal,
      providerContext: this.getContext(providerContext),
    });
  };

  public GetSearchPosts = async ({
    searchQuery,
    page,
    providerValue,
    signal,
    providerContext,
  }: {
    searchQuery: string;
    page: number;
    providerValue: string;
    signal: AbortSignal;
    providerContext: ProviderContext;
  }): Promise<Post[]> => {
    return getSearchPosts({
      searchQuery,
      page,
      providerValue: providerValue || this.id,
      signal,
      providerContext: this.getContext(providerContext),
    });
  };

  public GetMetaData = async ({
    link,
    providerContext,
  }: {
    link: string;
    provider: string;
    providerContext: ProviderContext;
  }): Promise<Info> => {
    return getMeta({
      link,
      providerContext: this.getContext(providerContext),
    });
  };

  public GetEpisodeLinks = async ({
    url,
    providerContext,
  }: {
    url: string;
    providerContext: ProviderContext;
  }): Promise<EpisodeLink[]> => {
    return getEpisodes({
      url,
      providerContext: this.getContext(providerContext),
    });
  };

  public GetStream = async ({
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
  }): Promise<Stream[]> => {
    return getStream({
      link,
      type,
      signal,
      providerContext: this.getContext(providerContext),
      isDownload,
    });
  };

  // Nexplay App / ScraperEngine Convenience Methods
  public async search(query: string, page = 1, signal?: AbortSignal): Promise<Post[]> {
    return this.GetSearchPosts({
      searchQuery: query,
      page,
      providerValue: this.id,
      signal: signal as any,
      providerContext: this.defaultContext,
    });
  }

  public async getCatalog(filter = "", page = 1, signal?: AbortSignal): Promise<Post[]> {
    return this.GetHomePosts({
      filter,
      page,
      providerValue: this.id,
      signal: signal as any,
      providerContext: this.defaultContext,
    });
  }

  public async getDetails(url: string): Promise<Info> {
    return this.GetMetaData({
      link: url,
      provider: this.id,
      providerContext: this.defaultContext,
    });
  }

  public async getEpisodeList(url: string): Promise<EpisodeLink[]> {
    return this.GetEpisodeLinks({
      url,
      providerContext: this.defaultContext,
    });
  }

  public async getStreams(url: string, signal?: AbortSignal): Promise<Stream[]> {
    return this.GetStream({
      link: url,
      type: "anime",
      signal,
      providerContext: this.defaultContext,
    });
  }
}

