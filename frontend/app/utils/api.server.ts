// app/utils/api.server.ts
export function apiFetch(
    request: Request,
    path: string,
    init: RequestInit = {},
  ) {
    const cookie = request.headers.get("Cookie") ?? "";
    return fetch(`${process.env.API_BASE_URL}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Cookie: cookie },
    });
  }
  