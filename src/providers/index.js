/**
 * Central Provider Catalog & Modular Registry for Providers-Nexplay
 * 
 * Cleanly organizes every provider into its own dedicated directory:
 * - src/providers/hdhub4u/      (Server 1: HDHub4u)
 * - src/providers/4khdhub/      (Server 2: 4KHDHub)
 * - src/providers/movies4u/     (Server 3: Movies4u)
 * - src/providers/tamildhool/   (Server 4: TamilDhool)
 * - src/providers/tamilgun/     (Server 5: TamilGun / Arivumani)
 * - src/providers/common/       (Shared date parser, stream helpers)
 */

import { HDHub4u, HDHub4uClient } from './hdhub4u/index.js';
import { FourKHDHub, FourKHDHubClient } from './4khdhub/index.js';
import { Movies4u, Movies4uClient, unpack } from './movies4u/index.js';
import { Provider111477, Provider111477Client } from './111477/index.js';
import { ProviderNetmirror, ProviderNetmirrorClient } from './netmirror/index.js';
import { 
  TamilDhool, 
  TamilDhoolClient, 
  parseMediaRequest, 
  buildProviderUrl, 
  extractStreamsFromHtml 
} from './tamildhool/index.js';
import { 
  TamilGun, 
  TamilGunClient, 
  REQUIRED_PLAYALLU_HEADERS, 
  REQUIRED_BUNNY_HEADERS 
} from './tamilgun/index.js';
import { parseDateInput } from './common/index.js';

export {
  HDHub4u,
  HDHub4uClient,
  FourKHDHub,
  FourKHDHubClient,
  Movies4u,
  Movies4uClient,
  unpack,
  Provider111477,
  Provider111477Client,
  ProviderNetmirror,
  ProviderNetmirrorClient,
  TamilDhool,
  TamilDhoolClient,
  parseMediaRequest,
  buildProviderUrl,
  extractStreamsFromHtml,
  TamilGun,
  TamilGunClient,
  REQUIRED_PLAYALLU_HEADERS,
  REQUIRED_BUNNY_HEADERS,
  parseDateInput
};

export const PROVIDERS = {
  hdhub4u: {
    id: 'hdhub4u',
    name: 'Server 1 (HDHub4u)',
    short: 'HDHub4u',
    serverNumber: 1,
    client: HDHub4u,
    type: 'movies_and_shows'
  },
  '4khdhub': {
    id: '4khdhub',
    name: 'Server 2 (4KHDHub)',
    short: '4KHDHub',
    serverNumber: 2,
    client: FourKHDHub,
    type: 'movies_and_shows'
  },
  movies4u: {
    id: 'movies4u',
    name: 'Server 3 (Movies4u)',
    short: 'Movies4u',
    serverNumber: 3,
    client: Movies4u,
    type: 'movies_and_shows'
  },
  '111477': {
    id: '111477',
    name: 'Server 4 (111477)',
    short: '111477',
    serverNumber: 4,
    client: Provider111477,
    type: 'movies_and_shows'
  },
  netmirror: {
    id: 'netmirror',
    name: 'Server 5 (Netmirror)',
    short: 'Netmirror',
    serverNumber: 5,
    client: ProviderNetmirror,
    type: 'movies_and_shows'
  },
  tamildhool: {
    id: 'tamildhool',
    name: 'Server 6 (TamilDhool)',
    short: 'TamilDhool',
    serverNumber: 6,
    client: TamilDhool,
    type: 'serials_and_shows'
  },
  tamilgun: {
    id: 'tamilgun',
    name: 'Server 7 (TamilGun)',
    short: 'TamilGun',
    serverNumber: 7,
    client: TamilGun,
    type: 'serials_and_movies'
  }
};

/**
 * Get provider instance by ID string or server number
 * @param {string|number} identifier e.g. 'netmirror', 5, '5', '111477', 4, '4', 'hdhub4u', 1
 * @returns {object|null}
 */
export function getProviderById(identifier) {
  if (!identifier) return null;
  const str = String(identifier).toLowerCase().trim();
  
  if (str === '1' || str === 'hdhub4u') return PROVIDERS.hdhub4u;
  if (str === '2' || str === '4khdhub') return PROVIDERS['4khdhub'];
  if (str === '3' || str === 'movies4u') return PROVIDERS.movies4u;
  if (str === '4' || str === '111477') return PROVIDERS['111477'];
  if (str === '5' || str === 'netmirror') return PROVIDERS.netmirror;
  if (str === '6' || str === 'tamildhool') return PROVIDERS.tamildhool;
  if (str === '7' || str === 'tamilgun') return PROVIDERS.tamilgun;

  return PROVIDERS[str] || null;
}

/**
 * Returns list of all registered provider descriptors
 */
export function getAllProviders() {
  return Object.values(PROVIDERS);
}

export default PROVIDERS;
