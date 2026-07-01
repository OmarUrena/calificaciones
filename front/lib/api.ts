import type {
  ApiErrorCode,
  ApiErrorPayload,
  ApiRequestOptions,
  UploadFileOptions,
} from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const TOKEN_STORAGE_KEY = "califapp_token";

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

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await fetch(buildUrl(path), buildOptions(options)).catch(() => {
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
  const response = await fetch(buildUrl(path), buildOptions(options)).catch(() => {
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

function buildOptions(options: ApiRequestOptions): RequestInit {
  const { token, headers, body, ...rest } = options;
  const authToken = token ?? getStoredToken();
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
