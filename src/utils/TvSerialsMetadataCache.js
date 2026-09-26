/**
 * TV Serials Metadata Cache & Multi-Server Engine
 * 
 * Supports:
 * - Server 1: Tamildhool (tamildhool.tech)
 * - Server 2: Tamilgun (arivumani.net)
 * - All Serials (Sun TV, Star Vijay, Zee Tamil)
 * - Reality Shows (Bigg Boss, Super Singer, Cooku with Comali, etc.)
 * - TV Programmes (Neeya Naana, Tamizha Tamizha, Vanakkam Tamizha, etc.)
 * - Special Events & Mega Shows (Viruthugal, Audio Launches, Sunday Specials)
 * - Real Poster Images for All Items
 */

import {
  COMPREHENSIVE_ALL_SERIALS,
  COMPREHENSIVE_ALL_REALITY,
  COMPREHENSIVE_ALL_PROGRAMMES,
  COMPREHENSIVE_ALL_EVENTS
} from './TvSerialsLiveScraper.js';

export const SERVERS = [
  {
    id: 'tamildhool',
    name: 'Tamildhool',
    displayName: 'Server 1 (Tamildhool)',
    shortName: 'Server 1',
    domain: 'tamildhool.tech',
    protocol: 'JSON Scrape',
    cdn: 'Bunny Stream CDN',
    latency: '0ms',
    status: 'Online',
    color: '#2563eb'
  },
  {
    id: 'tamilgun',
    name: 'Tamilgun (arivumani.net)',
    displayName: 'Server 2 (Tamilgun)',
    shortName: 'Server 2',
    domain: 'arivumani.net',
    protocol: 'PlayAllu AES Decrypt',
    cdn: 'PlayAllu / Bunny CDN',
    latency: '0ms',
    status: 'Online',
    color: '#10b981'
  }
];

export const CHANNELS = [
  {
    id: 'sun',
    code: 'sun',
    name: 'Sun TV',
    tamilName: 'சன் டிவி',
    color: '#f97316',
    icon: 'sunny',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/6/6f/Sun_TV_logo.svg/300px-Sun_TV_logo.svg.png'
  },
  {
    id: 'vijay',
    code: 'vijay',
    name: 'Star Vijay',
    tamilName: 'விஜய் டிவி',
    color: '#ef4444',
    icon: 'star',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/Star_Vijay_logo_2017.png/300px-Star_Vijay_logo_2017.png'
  },
  {
    id: 'zee',
    code: 'zee',
    name: 'Zee Tamil',
    tamilName: 'ஜீ தமிழ்',
    color: '#a855f7',
    icon: 'sparkles',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/b/b5/Zee_Tamil_logo.svg/300px-Zee_Tamil_logo.svg.png'
  }
];

// Rich Curated Metadata Cache for Server 1 (Tamildhool)
export const TAMILDHOOL_SERIALS_CACHE = COMPREHENSIVE_ALL_SERIALS.map(s => ({
  ...s,
  server: 'tamildhool'
}));

// Rich Curated Metadata Cache for Server 2 (Tamilgun / Arivumani)
export const TAMILGUN_SERIALS_CACHE = COMPREHENSIVE_ALL_SERIALS.map(s => ({
  ...s,
  id: `tg_${s.serialCode}`,
  server: 'tamilgun',
  networkTag: `ARIVUMANI • ${s.channel.toUpperCase()}`,
  borderColor: '#10b981',
  tag: 'Server 2 Mirror'
}));

// Popular Reality Shows
export const REALITY_SHOWS_CACHE = COMPREHENSIVE_ALL_REALITY;

// TV Programmes & Talk Shows Category
export const TV_PROGRAMMES_CACHE = COMPREHENSIVE_ALL_PROGRAMMES;

// Special Events & Mega Shows Category
export const SPECIAL_EVENTS_CACHE = COMPREHENSIVE_ALL_EVENTS;

export function getCachedSerialsForServer(serverId = 'tamildhool') {
  if (serverId === 'tamilgun') {
    return TAMILGUN_SERIALS_CACHE;
  }
  return TAMILDHOOL_SERIALS_CACHE;
}

export function findSerial(serialIdOrCode, serverId = 'tamildhool') {
  const list = getCachedSerialsForServer(serverId);
  const found = list.find(s => s.id === serialIdOrCode || s.serialCode === serialIdOrCode);
  if (found) return found;
  const inReality = REALITY_SHOWS_CACHE.find(r => r.id === serialIdOrCode || r.serialCode === serialIdOrCode);
  if (inReality) return inReality;
  const inPrg = TV_PROGRAMMES_CACHE.find(p => p.id === serialIdOrCode || p.serialCode === serialIdOrCode);
  if (inPrg) return inPrg;
  const inEvent = SPECIAL_EVENTS_CACHE.find(e => e.id === serialIdOrCode || e.serialCode === serialIdOrCode);
  return inEvent || list[0];
}
