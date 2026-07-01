export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

export type ApiErrorPayload = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  errors?: unknown;
};

export type ApiRequestOptions = RequestInit & {
  token?: string | null;
};

export type UploadFileOptions = {
  file: File;
  fieldName?: string;
  fields?: Record<string, string | number | boolean | null | undefined>;
  token?: string | null;
};
