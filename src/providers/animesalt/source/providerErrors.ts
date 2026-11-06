export function throwProviderError(
  provider: string,
  fnName: string,
  error: any,
): never {
  const message = error?.message || String(error);
  console.error(`[${provider}] Error in ${fnName}: ${message}`);
  throw new Error(`[${provider}:${fnName}] ${message}`);
}

