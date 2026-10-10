/**
 * DNS-over-HTTPS (DoH) Resolver & ISP Bypass Engine
 * 
 * Provides direct-IP and secure hostname encrypted DNS resolution using:
 * - Google DNS (8.8.8.8 / 8.8.4.4 / dns.google) [DEFAULT on install]
 * - Cloudflare (1.1.1.1 / 1.0.0.1 / cloudflare-dns.com)
 * - AdGuard DNS (94.140.14.14 / 94.140.15.15 / dns.adguard-dns.com)
 * - Quad9 (9.9.9.9 / 149.112.112.112 / dns.quad9.net)
 * - OpenDNS (208.67.222.222 / doh.opendns.com)
 * - Custom DoH Endpoints (RFC 8484 and JSON API supported)
 */

// Available Direct-IP & Hostname DNS-over-HTTPS (DoH) Providers
export const DNS_PROVIDERS = {
  GOOGLE: {
    id: 'google',
    name: 'Google DNS (8.8.8.8)',
    ip: '8.8.8.8',
    primaryDoh: 'https://8.8.8.8/resolve',
    secondaryDoh: 'https://8.8.4.4/resolve',
    hostnameDoh: 'https://dns.google/resolve',
    format: 'google',
    desc: 'Ultra-reliable global DNS with zero ISP filtering (Default)'
  },
  CLOUDFLARE: {
    id: 'cloudflare',
    name: 'Cloudflare (1.1.1.1)',
    ip: '1.1.1.1',
    primaryDoh: 'https://1.1.1.1/dns-query',
    secondaryDoh: 'https://1.0.0.1/dns-query',
    hostnameDoh: 'https://cloudflare-dns.com/dns-query',
    format: 'cloudflare',
    desc: 'Privacy-first, hyper-speed global DoH resolver'
  },
  ADGUARD: {
    id: 'adguard',
    name: 'AdGuard DNS',
    ip: '94.140.14.14',
    primaryDoh: 'https://94.140.14.14/resolve',
    secondaryDoh: 'https://94.140.15.15/resolve',
    hostnameDoh: 'https://dns.adguard-dns.com/resolve',
    format: 'google',
    desc: 'Privacy protection with tracker & ad filtering'
  },
  QUAD9: {
    id: 'quad9',
    name: 'Quad9 (9.9.9.9)',
    ip: '9.9.9.9',
    primaryDoh: 'https://9.9.9.9/dns-query',
    secondaryDoh: 'https://149.112.112.112/dns-query',
    hostnameDoh: 'https://dns.quad9.net/dns-query',
    format: 'wireformat',
    desc: 'Encrypted security & malware blocking DNS'
  },
  OPENDNS: {
    id: 'opendns',
    name: 'OpenDNS (208.67.222.222)',
    ip: '208.67.222.222',
    primaryDoh: 'https://208.67.222.222/dns-query',
    secondaryDoh: 'https://208.67.220.220/dns-query',
    hostnameDoh: 'https://doh.opendns.com/dns-query',
    format: 'wireformat',
    desc: 'High-speed Cisco OpenDNS cloud resolver'
  },
  CUSTOM: {
    id: 'custom',
    name: 'Custom DNS-over-HTTPS',
    ip: 'Custom',
    primaryDoh: '',
    secondaryDoh: '',
    hostnameDoh: '',
    format: 'auto',
    desc: 'User-configured custom DoH endpoint URL'
  }
};

// Default on installation: Google DNS (8.8.8.8)
let activeConfig = {
  enabled: true,
  providerId: 'google',
  customUrl: 'https://dns.google/resolve'
};

// Sync with native Android SharedPreferences on startup if running inside native app
let DnsPreference = null;
try {
  if (typeof globalThis !== 'undefined' && globalThis.NativeModules?.DnsPreferenceModule) {
    DnsPreference = globalThis.NativeModules.DnsPreferenceModule;
  }
} catch (e) {}

if (DnsPreference && typeof DnsPreference.getDnsConfig === 'function') {
  DnsPreference.getDnsConfig()
    .then((cfg) => {
      if (cfg && cfg.providerId) {
        activeConfig = {
          ...activeConfig,
          providerId: cfg.providerId.toLowerCase(),
          customUrl: cfg.customUrl || activeConfig.customUrl,
          enabled: typeof cfg.enabled === 'boolean' ? cfg.enabled : true
        };
        console.log(`[DnsResolver] Initialized DNS Config from Android SharedPreferences: ${activeConfig.providerId}`);
      }
    })
    .catch(() => {});
}

// In-memory DNS cache: hostname -> { ip: string, expiry: number }
const dnsCache = new Map();

/**
 * Get current DNS configuration
 */
export const getDnsConfig = () => ({ ...activeConfig });

/**
 * Set DNS configuration and persist across app restarts (via native bridge)
 */
export const setDnsConfig = (newConfig) => {
  activeConfig = {
    ...activeConfig,
    ...newConfig
  };
  dnsCache.clear();
  console.log(`[DnsResolver] Active DNS Provider set to: ${activeConfig.providerId} (DoH Enabled: ${activeConfig.enabled})`);

  // Persist to Android SharedPreferences / OkHttp native layer
  if (DnsPreference && typeof DnsPreference.setDnsConfig === 'function') {
    DnsPreference.setDnsConfig(
      activeConfig.providerId || 'google',
      activeConfig.customUrl || 'https://dns.google/resolve',
      activeConfig.enabled !== false
    ).catch((err) => {
      console.warn('[DnsResolver] Failed to sync DNS config to NativeModule:', err?.message || err);
    });
  }
};

/**
 * Build standard RFC 8484 DNS wireformat A-record query for hostname
 */
function buildDnsWireQuery(hostname) {
  const parts = hostname.split('.');
  let totalLen = 12 + 1 + 4;
  const encodedParts = parts.map((p) => {
    const bytes = [];
    for (let i = 0; i < p.length; i++) bytes.push(p.charCodeAt(i));
    totalLen += 1 + bytes.length;
    return bytes;
  });

  const buffer = new Uint8Array(totalLen);
  const view = new DataView(buffer.buffer);
  view.setUint16(0, 0x1234); // ID
  view.setUint16(2, 0x0100); // Standard query with recursion desired
  view.setUint16(4, 1);      // QDCOUNT: 1
  let offset = 12;
  for (const part of encodedParts) {
    buffer[offset++] = part.length;
    for (const b of part) {
      buffer[offset++] = b;
    }
  }
  buffer[offset++] = 0; // null root
  view.setUint16(offset, 1); // Type A
  offset += 2;
  view.setUint16(offset, 1); // Class IN
  return buffer;
}

/**
 * Parse RFC 8484 DNS response ArrayBuffer and extract the first IPv4 A-record
 */
function parseDnsWireResponse(buffer) {
  if (!buffer || buffer.byteLength < 12) return null;
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const ancount = view.getUint16(6);
  if (ancount === 0) return null;

  let offset = 12;
  while (offset < bytes.length && bytes[offset] !== 0) {
    offset += bytes[offset] + 1;
  }
  offset += 5; // null byte + qtype(2) + qclass(2)

  for (let i = 0; i < ancount; i++) {
    if (offset >= bytes.length) break;
    if ((bytes[offset] & 0xc0) === 0xc0) {
      offset += 2;
    } else {
      while (offset < bytes.length && bytes[offset] !== 0) {
        offset += bytes[offset] + 1;
      }
      offset += 1;
    }
    if (offset + 10 > bytes.length) break;
    const type = view.getUint16(offset);
    offset += 2;
    offset += 2; // class
    const ttl = view.getUint32(offset);
    offset += 4;
    const rdlen = view.getUint16(offset);
    offset += 2;

    if (type === 1 && rdlen === 4 && offset + 4 <= bytes.length) {
      const ip = `${bytes[offset]}.${bytes[offset + 1]}.${bytes[offset + 2]}.${bytes[offset + 3]}`;
      return { ip, ttl: ttl || 300 };
    }
    offset += rdlen;
  }
  return null;
}

function uint8ArrayToBase64Url(uint8) {
  let binary = '';
  for (let i = 0; i < uint8.byteLength; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Query a specific DoH endpoint directly for an A record (IPv4).
 * Supports JSON API (application/dns-json) with automatic fallback to standard RFC 8484 wireformat.
 */
export async function querySingleDohEndpoint(endpointUrl, hostname, timeoutMs = 3000) {
  if (!endpointUrl) return null;

  // 1. First try JSON DoH format (Google, Cloudflare, Adguard, NextDNS)
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const separator = endpointUrl.includes('?') ? '&' : '?';
    const requestUrl = `${endpointUrl}${separator}name=${encodeURIComponent(hostname)}&type=A`;

    const res = await fetch(requestUrl, {
      headers: {
        'Accept': 'application/dns-json, application/json',
        'User-Agent': 'NexPlay/2.0'
      },
      signal: controller ? controller.signal : undefined
    });

    if (res && res.ok) {
      const data = await res.json();
      if (data && data.Answer && Array.isArray(data.Answer)) {
        const aRecords = data.Answer.filter(
          (rec) => rec.type === 1 && typeof rec.data === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(rec.data.trim())
        );
        if (aRecords.length > 0) {
          const first = aRecords[0];
          return {
            ip: first.data.trim(),
            ttl: first.TTL || 300
          };
        }
      }
    }
  } catch (e) {
    // JSON query failed, proceed to wireformat fallback below
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  // 2. Wireformat RFC 8484 fallback (Quad9, OpenDNS, standard DoH servers)
  const wireController = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const wireTimeoutId = wireController ? setTimeout(() => wireController.abort(), timeoutMs) : null;

  try {
    const baseUrl = endpointUrl.split('?')[0];
    const wireQuery = buildDnsWireQuery(hostname);
    const b64 = uint8ArrayToBase64Url(wireQuery);
    const separator = baseUrl.includes('?') ? '&' : '?';
    const reqUrl = `${baseUrl}${separator}dns=${b64}`;

    const res = await fetch(reqUrl, {
      headers: {
        'Accept': 'application/dns-message',
        'User-Agent': 'NexPlay/2.0'
      },
      signal: wireController ? wireController.signal : undefined
    });

    if (res && res.ok) {
      const arrayBuf = await res.arrayBuffer();
      const parsed = parseDnsWireResponse(arrayBuf);
      if (parsed && parsed.ip) {
        return parsed;
      }
    }
  } catch (e) {
    // Both JSON and Wireformat failed for this specific endpoint
  } finally {
    if (wireTimeoutId) clearTimeout(wireTimeoutId);
  }

  return null;
}

/**
 * Resolve a domain name to an IPv4 address using Direct-IP & Hostname DoH.
 * Prioritizes the user's active selected provider and uses Promise.any race
 * to prevent carrier-blocked endpoints from causing resolution failures.
 * 
 * @param {string} domain - e.g. "api.themoviedb.org" or "new5.hdhub4u.cl"
 * @returns {Promise<string>} - IPv4 string or original hostname if unresolvable
 */
export const resolveDomain = async (domain) => {
  if (!domain) return domain;
  if (!activeConfig.enabled) return domain;

  // Clean domain name into pure hostname
  const hostname = domain.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].trim();
  if (!hostname || hostname === 'localhost' || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return hostname;
  }

  // Check in-memory DNS cache
  const cached = dnsCache.get(hostname);
  const now = Date.now();
  if (cached && cached.expiry > now) {
    return cached.ip;
  }

  // Assemble candidate endpoints for the user's active selected provider
  const primaryEndpoints = [];
  if (activeConfig.providerId === 'custom' && activeConfig.customUrl) {
    primaryEndpoints.push(activeConfig.customUrl.trim());
  } else {
    const activeProvider = DNS_PROVIDERS[activeConfig.providerId?.toUpperCase()] || DNS_PROVIDERS.GOOGLE;
    if (activeProvider.primaryDoh) primaryEndpoints.push(activeProvider.primaryDoh);
    if (activeProvider.secondaryDoh) primaryEndpoints.push(activeProvider.secondaryDoh);
    if (activeProvider.hostnameDoh) primaryEndpoints.push(activeProvider.hostnameDoh);
  }

  // 1. Try active provider endpoints with Promise.any race
  if (primaryEndpoints.length > 0) {
    try {
      const winner = await Promise.any(
        primaryEndpoints.map((url) =>
          querySingleDohEndpoint(url, hostname, 2500).then((res) => {
            if (res && res.ip) return res;
            throw new Error('No IP returned');
          })
        )
      );
      if (winner && winner.ip) {
        dnsCache.set(hostname, {
          ip: winner.ip,
          expiry: now + (winner.ttl * 1000)
        });
        return winner.ip;
      }
    } catch (e) {
      // Selected provider failed on this network, proceed to robust fallback
    }
  }

  // 2. Global Fallback endpoints (Google -> Cloudflare -> Adguard)
  const fallbackEndpoints = [
    'https://8.8.8.8/resolve',
    'https://dns.google/resolve',
    'https://1.1.1.1/dns-query',
    'https://cloudflare-dns.com/dns-query',
    'https://8.8.4.4/resolve',
    'https://94.140.14.14/resolve'
  ].filter((url) => !primaryEndpoints.includes(url));

  try {
    const fallbackWinner = await Promise.any(
      fallbackEndpoints.map((url) =>
        querySingleDohEndpoint(url, hostname, 2500).then((res) => {
          if (res && res.ip) return res;
          throw new Error('Fallback failed');
        })
      )
    );
    if (fallbackWinner && fallbackWinner.ip) {
      dnsCache.set(hostname, {
        ip: fallbackWinner.ip,
        expiry: now + (fallbackWinner.ttl * 1000)
      });
      return fallbackWinner.ip;
    }
  } catch (e) {}

  // If all DoH failed, return original hostname
  return hostname;
};

/**
 * Resolve a full URL using DoH, replacing the hostname with its resolved IP
 * and returning the required Host header for HTTP routing.
 */
export const resolveUrlWithDoh = async (url) => {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return { url, headers: {} };
  }

  try {
    const urlObj = new URL(url);
    const originalHostname = urlObj.hostname;
    
    // If already an IP address, return as is
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(originalHostname)) {
      return { url, headers: { Host: originalHostname }, ip: originalHostname };
    }

    const resolvedIp = await resolveDomain(originalHostname);
    if (resolvedIp && resolvedIp !== originalHostname) {
      urlObj.hostname = resolvedIp;
      return {
        url: urlObj.toString(),
        headers: { Host: originalHostname },
        originalHost: originalHostname,
        ip: resolvedIp
      };
    }
  } catch (err) {
    // If URL parsing fails, return original
  }

  return { url, headers: {} };
};

/**
 * Test DNS latency and connectivity to a provider.
 * Uses Promise.any across primary, secondary, and hostname endpoints so carrier IP blocks
 * on single IPs (e.g. 1.1.1.1 in India) do not produce false negatives.
 */
export const testDnsServer = async (providerId = 'google', customUrl = '') => {
  const p = DNS_PROVIDERS[providerId?.toUpperCase()] || DNS_PROVIDERS.GOOGLE;
  const candidateUrls = [];

  if (providerId === 'custom') {
    const targetUrl = customUrl ? customUrl.trim() : (activeConfig.customUrl || 'https://dns.google/resolve');
    candidateUrls.push(targetUrl);
  } else {
    if (p.primaryDoh) candidateUrls.push(p.primaryDoh);
    if (p.secondaryDoh) candidateUrls.push(p.secondaryDoh);
    if (p.hostnameDoh) candidateUrls.push(p.hostnameDoh);
  }

  if (candidateUrls.length === 0) {
    return {
      ok: false,
      latencyMs: 0,
      ip: null,
      error: 'No endpoint URL configured'
    };
  }

  try {
    const testPromises = candidateUrls.map(async (url) => {
      // Perform initial preflight to establish TCP & TLS 1.3 session, then measure true Keep-Alive DNS lookup latency
      await querySingleDohEndpoint(url, 'api.themoviedb.org', 2500).catch(() => null);
      const startTime = Date.now();
      const result = await querySingleDohEndpoint(url, 'api.themoviedb.org', 2500);
      const latency = Date.now() - startTime;
      if (result && result.ip) {
        return {
          ok: true,
          latencyMs: latency,
          ip: result.ip,
          provider: providerId,
          endpoint: url
        };
      }
      throw new Error(`Endpoint ${url} timed out or failed`);
    });

    const winningResult = await Promise.any(testPromises);
    return winningResult;
  } catch (err) {
    return {
      ok: false,
      latencyMs: 0,
      ip: null,
      error: 'DNS query timed out on all provider endpoints'
    };
  }
};
