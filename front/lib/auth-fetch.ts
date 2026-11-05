// Supabase treats a fetch failure as temporary and preserves the refresh token.
// A plain HTTP 429 is otherwise treated as a terminal error by the installed SDK.
export function createAuthFetch(supabaseUrl: string, fetcher: typeof fetch = fetch): typeof fetch {
  const refreshUrl = new URL("/auth/v1/token", supabaseUrl);
  let retryAt = 0;

  return async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url);
    const isRefresh = url.origin === refreshUrl.origin && url.pathname === refreshUrl.pathname &&
      url.searchParams.get("grant_type") === "refresh_token";
    if (!isRefresh) return fetcher(input, init);

    if (Date.now() < retryAt) {
      throw new Error("La renovación está temporalmente limitada. Espera un minuto y vuelve a intentarlo.");
    }

    const controller = new AbortController();
    const originalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const abort = () => controller.abort(originalSignal?.reason);
    if (originalSignal?.aborted) abort();
    else originalSignal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetcher(input, { ...init, signal: controller.signal });
      if (response.status === 429) {
        const header = response.headers.get("Retry-After");
        const seconds = header === null ? NaN : Number(header);
        const requestedRetryAt = Number.isFinite(seconds)
          ? Date.now() + seconds * 1000
          : Date.parse(header ?? "");
        retryAt = Math.max(Date.now() + 60_000, requestedRetryAt || 0);
        // Do not let the SDK discard a renewable session for rate limiting.
        throw new Error("La renovación está temporalmente limitada. Espera un minuto y vuelve a intentarlo.");
      }
      return response;
    } finally {
      clearTimeout(timer);
      originalSignal?.removeEventListener("abort", abort);
    }
  };
}
