import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract a user-friendly message from an error thrown by a Convex action.
 * Strips the "[CONVEX A(...)] [Request ID: ...] Server Error" noise and maps
 * common backend errors to human-readable strings.
 */
export function friendlyError(err: unknown, fallback = "Something went wrong"): string {
  if (!err) return fallback;
  const raw = err instanceof Error ? err.message : String(err);

  // Map recognized backend errors first
  if (/Could not resolve authentication method|apiKey or authToken/i.test(raw)) {
    return "AI isn’t configured yet — your Anthropic API key is missing on the server.";
  }
  if (/concurrent connections/i.test(raw)) {
    return "AI is busy with too many parses at once. Wait a few seconds and click again.";
  }
  if (/rate limit|429/i.test(raw)) {
    return "AI is rate-limited right now. Try again in a moment.";
  }
  if (/overloaded|529/i.test(raw)) {
    return "AI is overloaded. Try again in a moment.";
  }
  if (/Failed to parse Claude response/i.test(raw)) {
    return "AI returned an unexpected response. Try rephrasing.";
  }
  if (/Provide a description or photo/i.test(raw)) {
    return "Add a description or a photo first.";
  }
  if (/Photo upload failed/i.test(raw)) {
    return "Photo upload failed. Try a smaller image.";
  }

  // Generic Convex error cleanup
  const match = raw.match(/Uncaught (?:Error|[A-Za-z]+Error):\s*([^\n]+?)(?:\s+at\s|$)/);
  if (match) return match[1].trim();

  // Strip the "[CONVEX A(name)] [Request ID: x] Server Error " prefix
  const prefixStripped = raw
    .replace(/^\[CONVEX [^\]]+\]\s*/, "")
    .replace(/^\[Request ID: [^\]]+\]\s*/, "")
    .replace(/^Server Error\s*/i, "")
    .replace(/^Uncaught\s+(?:[A-Za-z]+Error:?\s*)/, "")
    .split("\n")[0]
    .trim();

  return prefixStripped || fallback;
}
