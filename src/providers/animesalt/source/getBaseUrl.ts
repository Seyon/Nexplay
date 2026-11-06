import { ProviderContext } from "./types";

const DEFAULT_BASE_URL = "https://animesalt.cx";

export async function getBaseUrl(
  providerValue: string = "animesalt",
  providerContext?: ProviderContext,
): Promise<string> {
  if (providerContext?.kvStore) {
    try {
      const cached = await providerContext.kvStore.get<string>(`base_url_${providerValue}`);
      if (cached && typeof cached === "string" && cached.startsWith("http")) {
        return cached.replace(/\/+$/, "");
      }
    } catch {
      // ignore
    }
  }

  return DEFAULT_BASE_URL;
}

