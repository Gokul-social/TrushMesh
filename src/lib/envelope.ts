export type ApiEnvelope<T> = {
  data: T | null;
  meta?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function ok<T>(data: T, meta?: Record<string, unknown>): ApiEnvelope<T> {
  return meta ? { data, meta } : { data };
}

export function fail(
  code: string,
  message: string,
  details?: unknown
): ApiEnvelope<null> {
  return {
    data: null,
    error: details ? { code, message, details } : { code, message }
  };
}
