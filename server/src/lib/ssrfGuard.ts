import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Blocks scrape requests that resolve to private/loopback/link-local ranges,
 * preventing the scraper from being used to probe internal services.
 */
export async function isPrivateHost(hostname: string): Promise<boolean> {
  let address = hostname;
  if (!isIP(hostname)) {
    try {
      const result = await lookup(hostname);
      address = result.address;
    } catch {
      return true; // unresolvable — refuse
    }
  }
  return isPrivateAddress(address);
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower.startsWith("::ffff:")) {
      // v4-mapped — re-check the embedded v4
      return isPrivateAddress(lower.slice("::ffff:".length));
    }
    return (
      lower === "::1" ||
      lower.startsWith("fe80:") ||
      lower.startsWith("fc") ||
      lower.startsWith("fd")
    );
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return true;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}
