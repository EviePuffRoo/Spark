import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Blocks the classic SSRF vector where a DM-supplied webhook URL points at
// something on Spark's own network (a cloud metadata endpoint, an internal
// admin panel, localhost) instead of a real third party. Two checks, both
// required: HTTPS-only (so at minimum the target must present a valid TLS
// cert for its hostname), and the resolved IP(s) must not be
// private/reserved. Re-run before every delivery attempt, not just at
// save time, so a DNS-rebinding domain can't slip a private IP in later.
export class WebhookUrlError extends Error {}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && parts[2] === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && parts[2] === 2) return true; // TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
  if (a === 198 && b === 51 && parts[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && parts[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast (224-239) + reserved (240-255) + broadcast
  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const addr = ip.toLowerCase();
  if (addr === "::1" || addr === "::") return true; // loopback / unspecified
  // IPv4-mapped (::ffff:a.b.c.d) — check the embedded IPv4 address.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateOrReservedIpv4(mapped[1]);
  const firstGroup = addr.split(":")[0];
  if (/^fe[89ab][0-9a-f]$/.test(firstGroup)) return true; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}$/.test(firstGroup)) return true; // fc00::/7 unique local
  if (addr.startsWith("ff")) return true; // ff00::/8 multicast
  if (addr.startsWith("2001:db8:")) return true; // documentation range
  return false;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateOrReservedIpv4(ip);
  if (version === 6) return isPrivateOrReservedIpv6(ip);
  return true; // not a recognizable IP — treat as unsafe
}

// Throws WebhookUrlError with a DM-facing message if the URL isn't safe to
// deliver to. Resolves the hostname itself (dns.lookup, not a browser),
// so this genuinely defends against DNS-rebinding, not just a naive
// hostname denylist.
export async function validateWebhookUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new WebhookUrlError("Not a valid URL.");
  }
  if (url.protocol !== "https:") {
    throw new WebhookUrlError("Webhook URL must use https://.");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new WebhookUrlError("Webhook URL can't point at localhost.");
  }

  // An IP literal in the URL bypasses DNS entirely — check it directly.
  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new WebhookUrlError("Webhook URL can't point at a private or reserved IP address.");
    }
    return;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new WebhookUrlError("Couldn't resolve the webhook URL's hostname.");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateOrReservedIp(a.address))) {
    throw new WebhookUrlError("Webhook URL resolves to a private or reserved IP address.");
  }
}
