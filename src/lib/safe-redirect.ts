/**
 * Returns `path` only if it is a same-origin relative path ("/foo?bar").
 * Rejects absolute URLs, protocol-relative ("//evil.com") and backslash
 * tricks so it can be safely appended to our own origin.
 */
export function safeRedirectPath(path: string | null | undefined, fallback = '/home'): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return fallback
  }
  return path
}
