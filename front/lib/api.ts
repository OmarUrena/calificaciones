import type {
  ApiErrorCode,
  ApiErrorPayload,
  ApiRequestOptions,
  UploadFileOptions,
} from "@/types/api";
import { SESSION_IDLE_MS, SESSION_LAST_ACTIVITY_KEY } from "@/lib/session-config";
import { supabase } from "@/lib/supabase-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  payload?: ApiErrorPayload;

  constructor(status: number, code: ApiErrorCode, message: string, payload?: ApiErrorPayload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export function getApiBaseUrl() {
  return API_URL.replace(/\/$/, "");
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await fetch(buildUrl(path), await buildOptions(options)).catch(() => {
    throw new ApiError(0, "NETWORK_ERROR", "No se pudo conectar con el servidor.");
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function downloadBlob(path: string, options: ApiRequestOptions = {}) {
  const response = await fetch(buildUrl(path), await buildOptions(options)).catch(() => {
    throw new ApiError(0, "NETWORK_ERROR", "No se pudo descargar el archivo.");
  });

  if (!response.ok) {
    throw await buildApiError(response);
  }

  return response.blob();
}

export async function uploadFile<T>(path: string, options: UploadFileOptions): Promise<T> {
  const formData = new FormData();
  formData.append(options.fieldName ?? "file", options.file);

  Object.entries(options.fields ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, String(value));
    }
  });

  return apiFetch<T>(path, {
    method: "POST",
    body: formData,
    token: options.token,
  });
}

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

async function buildOptions(options: ApiRequestOptions): Promise<RequestInit> {
  const { token, headers, body, ...rest } = options;
  const authToken = token ?? (await getAccessToken());
  const requestHeaders = new Headers(headers);

  if (authToken) {
    requestHeaders.set("Authorization", `Bearer ${authToken}`);
  }

  if (body && !(body instanceof FormData) && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  return {
    ...rest,
    body,
    headers: requestHeaders,
  };
}

async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    if ([400, 401, 403].includes(error.status ?? 0)) {
      throw new ApiError(401, "UNAUTHENTICATED", "La sesión ya no es válida.");
    }
    throw new ApiError(0, "NETWORK_ERROR", "No se pudo verificar la sesión. Inténtalo de nuevo.");
  }

  if (data.session && typeof window !== "undefined") {
    const lastActivity = Number(window.localStorage.getItem(SESSION_LAST_ACTIVITY_KEY));
    if (lastActivity > 0 && Date.now() - lastActivity >= SESSION_IDLE_MS) {
      throw new ApiError(401, "UNAUTHENTICATED", "La sesión terminó por inactividad.");
    }
  }

  return data.session?.access_token ?? null;
}

async function buildApiError(response: Response) {
  const payload = await parseErrorPayload(response);
  const message = getErrorMessage(response.status, payload);

  return new ApiError(response.status, getErrorCode(response.status), message, payload);
}

async function parseErrorPayload(response: Response): Promise<ApiErrorPayload | undefined> {
  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) return undefined;

  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return undefined;
  }
}

function getErrorCode(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 400 || status === 422) return "VALIDATION_ERROR";
  if (status >= 500) return "SERVER_ERROR";
  return "UNKNOWN_ERROR";
}

function getErrorMessage(status: number, payload?: ApiErrorPayload) {
  if (Array.isArray(payload?.message)) return payload.message.join(" ");
  if (payload?.message) return payload.message;

  switch (status) {
    case 401:
      return "Debes iniciar sesión para continuar.";
    case 403:
      return "No tienes permiso para realizar esta acción.";
    case 404:
      return "El recurso solicitado no fue encontrado.";
    case 400:
    case 422:
      return "Revisa los datos enviados.";
    default:
      return status >= 500 ? "Ocurrió un error del servidor." : "Ocurrió un error inesperado.";
  }
}
