import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Image,
  ImageBackground,
  Modal,
  TextInput,
  ActivityIndicator,
  StatusBar,
  PanResponder,
  Pressable,
  BackHandler
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import VLCPlayerView, { VLCHardwareDecoder } from '@lunarr/vlc-player';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, verticalScale, moderateScale } from '../utils/responsive';
import {
  SERVERS,
  CHANNELS,
  REALITY_SHOWS_CACHE,
  TV_PROGRAMMES_CACHE,
  getCachedSerialsForServer,
  findSerial
} from '../utils/TvSerialsMetadataCache';
import {
  scrapeLiveCatalogFromServers,
  scrapeEpisodeStreamWithMetadata
} from '../utils/TvSerialsLiveScraper';

const { width: windowWidth } = Dimensions.get('window');

// Channel Logo component with official branding + vector fallback (KTV removed)
function ChannelLogo({ channelCode, size = scale(16), style }) {
  const channel = CHANNELS.find(c => c.code === channelCode || c.id === channelCode);
  const [hasError, setHasError] = useState(false);

  if (channel && channel.logoUrl && !hasError) {
    return (
      <Image
        source={{ uri: channel.logoUrl }}
        style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
        onError={() => setHasError(true)}
      />
    );
  }

  switch (channelCode) {
    case 'sun':
      return <Ionicons name="sunny" size={size} color="#f59e0b" style={style} />;
    case 'vijay':
      return <FontAwesome5 name="star" size={size * 0.85} color="#ef4444" style={style} />;
    case 'zee':
      return <MaterialCommunityIcons name="weather-sunset-up" size={size} color="#a855f7" style={style} />;
    default:
      return <Ionicons name="tv" size={size} color="#3b82f6" style={style} />;
  }
}

export default function TvSerialsScreen({ onMoviePress, onDetailStateChange }) {
  const insets = useSafeAreaInsets();
  const topNotchPadding = Math.max(insets.top, StatusBar.currentHeight || 0, 10);

  // Screen View Mode: Home Catalog vs Individual Detailed Serial Screen
  const [isDetailView, setIsDetailView] = useState(false);

  useEffect(() => {
    if (onDetailStateChange) {
      onDetailStateChange(isDetailView);
    }
  }, [isDetailView, onDetailStateChange]);

  // Step 1: Active Server (Server 1: Tamildhool vs Server 2: Tamilgun)
  const [activeServerId, setActiveServerId] = useState('tamildhool');
  const activeServer = SERVERS.find(s => s.id === activeServerId) || SERVERS[0];

  // Serials for the active server
  const allServerSerials = useMemo(() => {
    return getCachedSerialsForServer(activeServerId);
  }, [activeServerId]);

  // Home Page State
  const [homeChannelFilter, setHomeChannelFilter] = useState('all');
  const [heroIndex, setHeroIndex] = useState(0);
  const [isHeroPaused, setIsHeroPaused] = useState(false);

  // Step 2: Selected Serial for Detail View
  const [selectedSerial, setSelectedSerial] = useState(allServerSerials[0]);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Step 3: Calendar Date Picker State (Defaults to 26-09-2026)
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date(2026, 8, 26)); // Sep 26, 2026
  const [selectedDay, setSelectedDay] = useState(26);

  // Live Scraped Stream & Referer State for VLC Player Engine
  const [currentStreamUrl, setCurrentStreamUrl] = useState('');
  const [currentStreamHeaders, setCurrentStreamHeaders] = useState(null);
  const [currentStreamReferer, setCurrentStreamReferer] = useState('');
  const [activeMetadataQuery, setActiveMetadataQuery] = useState('');
  const [activeMetadataDisplay, setActiveMetadataDisplay] = useState('');
  const [scrapedServerName, setScrapedServerName] = useState('');
  const [scraperLoadingMessage, setScraperLoadingMessage] = useState('');
  const [playbackError, setPlaybackError] = useState(null);

  // In-Screen VLC Player State (Identical UI/UX layout to existing VLC Player in MovieDetailScreen)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPlayerActive, setIsPlayerActive] = useState(false);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [contentFitMode, setContentFitMode] = useState('contain');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const controlsTimerRef = useRef(null);
  const bufferingTimeoutRef = useRef(null);
  const isScrubbingRef = useRef(false);
  const pendingSeekTimeRef = useRef(null);
  const lastSeekTimestampRef = useRef(0);
  const scrubStartLocationX = useRef(0);
  const scrubberWidthRef = useRef(windowWidth - scale(28));
  const [scrubberWidth, setScrubberWidth] = useState(windowWidth - scale(28));
  const vlcPlayerRef = useRef(null);

  // Synchronize Hardware Screen Orientation and Fullscreen System UI
  useEffect(() => {
    const handleOrientation = async () => {
      try {
        if (isFullscreen) {
          if (ScreenOrientation && typeof ScreenOrientation.lockAsync === 'function') {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          }
          StatusBar.setHidden(true, 'fade');
        } else {
          if (ScreenOrientation && typeof ScreenOrientation.lockAsync === 'function') {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          }
          StatusBar.setHidden(false, 'fade');
        }
      } catch (e) {
        console.warn('[TvSerialsScreen] Orientation error:', e);
      }
    };
    handleOrientation();
  }, [isFullscreen]);

  // Hardware Back Button handler (Minimizes fullscreen or navigates back)
  useEffect(() => {
    const onBackPress = () => {
      if (isFullscreen) {
        setIsFullscreen(false);
        return true;
      }
      if (isDetailView) {
        setIsPlaying(false);
        setIsPlayerActive(false);
        setIsDetailView(false);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isFullscreen, isDetailView]);

  // Pulse animation for Live Broadcast dot & Decryptor Engine node
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Highlights for the Hero Carousel (Featured Prime Shows: Kayal #1 matching reference + Bigg Boss 10 + Flagships)
  const heroHighlights = useMemo(() => {
    const biggBossEntry = {
      id: 'vijay_bigg_boss_10',
      serialCode: 'bigg_boss_10',
      title: 'Bigg Boss 10',
      tamilTitle: 'பிக் பாஸ் 10',
      channel: 'Star Vijay',
      channelCode: 'vijay',
      networkTag: 'VIJAY TV • PRIME',
      genre: 'Mega Reality',
      tag: 'Prime Show',
      image: 'https://www.tamildhool.tech/wp-content/uploads/2026/09/bbtamil.jpg',
      bgColor: '#1e1b4b',
      borderColor: '#ef4444',
      tamilColor: '#ef4444'
    };

    const curated = [];
    const kayalEntry = allServerSerials.find(s => s.serialCode === 'kayal');
    if (kayalEntry) curated.push(kayalEntry);
    curated.push(biggBossEntry);

    const otherFlagships = ['singapennae', 'vanathai_pola', 'marumagal', 'moondru_mudichu', 'siragadikka_aasai', 'karthigai_deepam'];
    for (const code of otherFlagships) {
      const found = allServerSerials.find(s => s.serialCode === code);
      if (found) curated.push(found);
    }
    return curated;
  }, [allServerSerials]);

  // Auto-rotate hero carousel on TV Serials Home Page
  useEffect(() => {
    if (isHeroPaused || isDetailView) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroHighlights.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isHeroPaused, isDetailView, heroHighlights.length]);

  const currentHero = heroHighlights[heroIndex % heroHighlights.length] || allServerSerials[0];

  // Open Individual Detailed Serial Screen and immediately trigger server scraper
  const handleOpenDetailScreen = (item) => {
    setSelectedSerial(item);
    setIsDetailView(true);
    executeScrapeAndPlay(item, selectedDay, activeServerId, currentCalendarDate);
  };

  // Hero description helper
  const getHeroDescription = useCallback((hero) => {
    if (!hero) return '';
    if (hero.description) return hero.description;
    if (hero.serialCode === 'bigg_boss_10') {
      return 'The premier reality spectacle in Tamil television. Uncut 24x7 drama, daily tasks, nominations, and weekend eviction specials.';
    }
    if (hero.serialCode === 'kayal') {
      return 'A moving emotional journey of a devoted woman standing steadfast as the anchor of her family through trials.';
    }
    if (hero.serialCode === 'singapennae') {
      return 'An inspiring tale of a determined young woman overcoming odds and achieving independence in the corporate world.';
    }
    if (hero.serialCode === 'siragadikka_aasai') {
      return 'A heartwarming family drama exploring modern marital relationships, trust, and endearing ambitions.';
    }
    if (hero.serialCode === 'karthigai_deepam') {
      return 'A touching cultural drama where genuine love and deep respect illuminate every relationship.';
    }
    return `${hero.title} (${hero.tamilTitle}) airing on ${hero.channel}. High definition Tamil broadcast.`;
  }, []);

  // Calendar Helpers for Step 3
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const monthName = currentCalendarDate.toLocaleString('default', { month: 'short' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday

  const prevMonth = () => {
    setCurrentCalendarDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentCalendarDate(new Date(year, month + 1, 1));
  };

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push({ day: null, key: `empty-${i}` });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ day: d, key: `day-${d}` });
  }

  // Row-chunked calendar (7 days per row) to ensure 100% stable flex grid on Android
  const calendarRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      rows.push(calendarDays.slice(i, i + 7));
    }
    if (rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      while (lastRow.length < 7) {
        lastRow.push({ day: null, key: `empty-pad-${lastRow.length}` });
      }
    }
    return rows;
  }, [calendarDays]);

  // All selectable items for Step 2 (Serials + Reality Shows + TV Programmes)
  const allSelectableItems = useMemo(() => {
    return [
      ...allServerSerials,
      ...REALITY_SHOWS_CACHE,
      ...TV_PROGRAMMES_CACHE
    ];
  }, [allServerSerials]);

  // Filter serials and events in dropdown by search query
  const filteredDropdownSerials = useMemo(() => {
    if (!searchQuery.trim()) return allSelectableItems;
    const q = searchQuery.toLowerCase().trim();
    return allSelectableItems.filter(
      s => (s.title && s.title.toLowerCase().includes(q)) ||
           (s.tamilTitle && s.tamilTitle.includes(q)) ||
           (s.channel && s.channel.toLowerCase().includes(q)) ||
           (s.genre && s.genre.toLowerCase().includes(q)) ||
           (s.tag && s.tag.toLowerCase().includes(q))
    );
  }, [allSelectableItems, searchQuery]);

  /**
   * Formats metadata query strictly according to user requirements:
   * Server 1 (Tamildhool): "{Title} | {DD-MM-YYYY} |"  (e.g., "Kayal | 26-09-2026 |")
   * Server 2 (Tamilgun):   "{Title} {DD-MM-YYYY}"     (e.g., "Kayal 22-09-2026")
   */
  const buildMetadataString = (serial, dayNum = selectedDay, calDate = currentCalendarDate, serverId = activeServerId) => {
    if (!serial) return '';
    const d = String(dayNum).padStart(2, '0');
    const m = String(calDate.getMonth() + 1).padStart(2, '0');
    const y = calDate.getFullYear();
    const dateFormatted = `${d}-${m}-${y}`;
    if (serverId === 'tamilgun') {
      return `${serial.title} ${dateFormatted}`;
    }
    return `${serial.title} | ${dateFormatted} |`;
  };

  // Controls auto-hide timer & toggle matching MovieDetailScreen
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
    setControlsVisible(true);

    controlsTimerRef.current = setTimeout(() => {
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setControlsVisible(false);
      });
    }, 4000);
  }, [controlsOpacity]);

  const toggleControls = useCallback(() => {
    if (controlsVisible) {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setControlsVisible(false);
      });
    } else {
      resetControlsTimeout();
    }
  }, [controlsVisible, resetControlsTimeout, controlsOpacity]);

  const cyclePlaybackSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIdx]);
    resetControlsTimeout();
  };

  const toggleContentFitMode = () => {
    setContentFitMode(prev => (prev === 'cover' ? 'contain' : 'cover'));
    resetControlsTimeout();
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
    resetControlsTimeout();
  };

  const togglePlayerServer = () => {
    const nextServerId = activeServerId === 'tamildhool' ? 'tamilgun' : 'tamildhool';
    setActiveServerId(nextServerId);
    executeScrapeAndPlay(selectedSerial, selectedDay, nextServerId, currentCalendarDate);
    resetControlsTimeout();
  };

  // Dynamic seconds counter and total duration formatter
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds == null || seconds < 0) return '00:00';
    const totalSecs = Math.floor(seconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const formattedSecs = secs < 10 ? `0${secs}` : `${secs}`;
    if (hrs > 0) {
      const formattedMins = mins < 10 ? `0${mins}` : `${mins}`;
      return `${hrs}:${formattedMins}:${formattedSecs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${formattedSecs}`;
  };

  // Robust seek handler for VLC Player View
  const seekToTimestamp = (targetSeconds) => {
    if (!vlcPlayerRef.current) return;
    const num = Number(targetSeconds);
    if (isNaN(num) || !isFinite(num)) return;
    const safeDuration = (typeof playbackDuration === 'number' && playbackDuration > 0) ? playbackDuration : 1320;
    const target = Math.max(0, Math.min(safeDuration, num));

    pendingSeekTimeRef.current = target;
    lastSeekTimestampRef.current = Date.now();
    setPlaybackTime(target);

    try {
      vlcPlayerRef.current.seek(target);
    } catch (e) {
      console.warn('[TvSerialsScreen] seek error:', e);
    }
    resetControlsTimeout();
  };

  const handleSeek = (delta) => {
    const safeDuration = (typeof playbackDuration === 'number' && playbackDuration > 0) ? playbackDuration : 1320;
    const current = (typeof playbackTime === 'number' && !isNaN(playbackTime)) ? playbackTime : 0;
    seekToTimestamp(Math.max(0, Math.min(safeDuration, current + delta)));
  };

  const getScrubberSeekTime = (evt, gestureState) => {
    const safeDuration = (typeof playbackDuration === 'number' && playbackDuration > 0) ? playbackDuration : 1320;
    const curWidth = scrubberWidthRef.current || scrubberWidth || (windowWidth - scale(28));
    if (curWidth <= 0) return 0;

    let touchX = -1;
    if (gestureState && typeof gestureState.dx === 'number' && Math.abs(gestureState.dx) > 0 && scrubStartLocationX.current >= 0) {
      touchX = scrubStartLocationX.current + gestureState.dx;
    } else if (typeof evt?.nativeEvent?.locationX === 'number' && evt.nativeEvent.locationX >= 0) {
      touchX = evt.nativeEvent.locationX;
    }

    if (touchX < 0) touchX = 0;
    const progress = Math.max(0, Math.min(1, touchX / curWidth));
    return progress * safeDuration;
  };

  // Interactive timeline scrubber gesture responder
  const scrubberPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        isScrubbingRef.current = true;
        const locX = evt?.nativeEvent?.locationX;
        scrubStartLocationX.current = (typeof locX === 'number' && locX >= 0) ? locX : 0;
        const targetSeekTime = getScrubberSeekTime(evt, gestureState);
        setPlaybackTime(targetSeekTime);
        resetControlsTimeout();
      },
      onPanResponderMove: (evt, gestureState) => {
        const targetSeekTime = getScrubberSeekTime(evt, gestureState);
        setPlaybackTime(targetSeekTime);
        resetControlsTimeout();
      },
      onPanResponderRelease: (evt, gestureState) => {
        isScrubbingRef.current = false;
        const targetSeekTime = getScrubberSeekTime(evt, gestureState);
        seekToTimestamp(targetSeekTime);
      },
      onPanResponderTerminate: () => {
        isScrubbingRef.current = false;
      }
    });
  }, [playbackDuration, scrubberWidth, resetControlsTimeout]);

  /**
   * Execute live server scraper with formatted metadata and post stream + referer to VLC Player
   */
  const executeScrapeAndPlay = async (targetSerial = selectedSerial, dayNum = selectedDay, serverId = activeServerId, calDate = currentCalendarDate) => {
    if (!targetSerial) return;
    const d = String(dayNum).padStart(2, '0');
    const m = String(calDate.getMonth() + 1).padStart(2, '0');
    const y = calDate.getFullYear();
    const dateStr = `${d}-${m}-${y}`;
    const metadata = buildMetadataString(targetSerial, dayNum, calDate, serverId);

    if (bufferingTimeoutRef.current) clearTimeout(bufferingTimeoutRef.current);
    setActiveMetadataQuery(metadata);
    setActiveMetadataDisplay(metadata);
    setIsLoadingStream(true);
    setIsPlayerActive(true);
    setIsPlaying(true);
    setIsBuffering(true);
    setPlaybackTime(0);
    pendingSeekTimeRef.current = null;
    resetControlsTimeout();
    const serverLabel = serverId === 'tamilgun' ? 'Server 2' : 'Server 1';
    setScraperLoadingMessage(`Querying ${serverLabel} for:\n${metadata}`);
    setPlaybackError(null);

    // Set safety timeout to guarantee buffering clears even if stream stalls
    bufferingTimeoutRef.current = setTimeout(() => {
      setIsBuffering(false);
      setIsLoadingStream(false);
    }, 6000);

    try {
      const res = await scrapeEpisodeStreamWithMetadata(metadata, targetSerial, dateStr, serverId);
      if (res && res.streamUrl) {
        setCurrentStreamUrl(res.streamUrl);
        setCurrentStreamHeaders(res.headers || {});
        setCurrentStreamReferer(res.referer || res.headers?.Referer || res.headers?.referer || '');
        setScrapedServerName(res.server || serverLabel);
        setActiveMetadataDisplay(metadata);
        setPlaybackError(null);
      } else {
        setCurrentStreamUrl(null);
        setCurrentStreamHeaders(null);
        setCurrentStreamReferer('');
        setIsPlaying(false);
        setIsBuffering(false);
        setPlaybackError(`Playback Error: Stream unavailable for ${targetSerial?.title || 'this serial'} on ${serverLabel} for ${dateStr}. Please select another date or switch server.`);
      }
    } catch (err) {
      console.warn('[TvSerialsScreen] Live scraper error:', err?.message || err);
      setCurrentStreamUrl(null);
      setCurrentStreamHeaders(null);
      setCurrentStreamReferer('');
      setIsPlaying(false);
      setIsBuffering(false);
      setPlaybackError(`Playback Error: Unable to fetch stream from ${serverLabel} (${err?.message || 'Network error'}). Please try again or switch server.`);
    } finally {
      setIsLoadingStream(false);
    }
  };

  // Handle Play Episode directly inside TV Serials (No jump to Movie Details!)
  const handlePlayEpisode = (dayNum = selectedDay) => {
    setSelectedDay(dayNum);
    executeScrapeAndPlay(selectedSerial, dayNum, activeServerId, currentCalendarDate);
  };

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
    resetControlsTimeout();
  };

  // Active Stream Source strictly configured for existing VLCPlayerView with Hardware Decoding
  const activeStreamSource = useMemo(() => {
    if (!currentStreamUrl) return null;
    const playUri = currentStreamUrl;
    const initOptions = [
      '--network-caching=1500',
      '--live-caching=1500',
      '--file-caching=1500',
      '--clock-jitter=300',
      '--clock-synchro=1',
      '--fast-seek',
      '--drop-late-frames',
      '--skip-frames',
      '--no-sub-autodetect-file',
      '--no-stats',
      '--avcodec-fast',
      '--no-audio-time-stretch',
      '--ipv4-timeout=5000'
    ];

    const mediaOptions = [
      ':network-caching=1500',
      ':live-caching=1500',
      ':file-caching=1500',
      ':sout-mux-caching=1500',
      ':clock-jitter=300',
      ':clock-synchro=1',
      ':fast-seek=true',
      ':avcodec-fast=true',
      ':avcodec-threads=4',
      ':no-sub-autodetect-file',
      ':http-reconnect=true',
      ':http-continuous=true',
      ':no-stats'
    ];

    const ref = currentStreamReferer || currentStreamHeaders?.Referer || currentStreamHeaders?.referer || (activeServerId === 'tamildhool' ? 'https://tamildhool.tech/' : '');
    if (ref) {
      initOptions.push(`--http-referrer=${ref}`);
      mediaOptions.push(`:http-referrer=${ref}`);
    }
    const ua = currentStreamHeaders?.['User-Agent'] || currentStreamHeaders?.['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
    if (ua) {
      initOptions.push(`--http-user-agent=${ua}`);
      mediaOptions.push(`:http-user-agent=${ua}`);
    }

    return {
      uri: playUri,
      hwDecoderEnabled: VLCHardwareDecoder?.Full ?? 2,
      mediaOptions,
      initOptions
    };
  }, [currentStreamUrl, currentStreamReferer, currentStreamHeaders, activeServerId]);

  // Serials for Home Page strictly deduplicated for Index Catalog (No duplicate Kayal or any serial)
  const homeFilteredSerials = useMemo(() => {
    const list = homeChannelFilter === 'all'
      ? allServerSerials
      : allServerSerials.filter(s => s.channelCode === homeChannelFilter);
    const seen = new Set();
    return list.filter(item => {
      const key = (item.title || item.serialCode || '').toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [homeChannelFilter, allServerSerials]);

  const homeFilteredReality = useMemo(() => {
    const list = homeChannelFilter === 'all'
      ? REALITY_SHOWS_CACHE
      : REALITY_SHOWS_CACHE.filter(r => r.channelCode === homeChannelFilter);
    const seen = new Set();
    return list.filter(item => {
      const key = (item.title || item.serialCode || '').toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [homeChannelFilter]);

  const homeFilteredProgrammes = useMemo(() => {
    const list = homeChannelFilter === 'all'
      ? TV_PROGRAMMES_CACHE
      : TV_PROGRAMMES_CACHE.filter(p => p.channelCode === homeChannelFilter);
    const seen = new Set();
    return list.filter(item => {
      const key = (item.title || item.serialCode || '').toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [homeChannelFilter]);


  // ==============================================================
  // VIEW 2: INDIVIDUAL DETAILED SERIAL SCREEN (Step 1, 2, 3 + Player below camera hole)
  // ==============================================================
  if (isDetailView && selectedSerial) {
    return (
      <View style={[styles.detailScreenContainer, { paddingTop: isFullscreen ? 0 : topNotchPadding }]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" hidden={isFullscreen} />

        {/* TOP NAVIGATION BAR: BACK TO TV SERIALS HOME (Shown only in portrait) */}
        {!isFullscreen && (
          <View style={styles.detailNavBar}>
            <TouchableOpacity
              style={styles.detailBackBtn}
              onPress={() => {
                setIsPlaying(false);
                setIsPlayerActive(false);
                setIsDetailView(false);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={scale(20)} color="#ffffff" />
              <Text style={styles.detailBackBtnText}>TV Serials Home</Text>
            </TouchableOpacity>

            <View style={styles.detailServerBadge}>
              <View style={[styles.statusDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.detailServerBadgeText}>{activeServer.displayName}</Text>
            </View>
          </View>
        )}

        {/* UNIFIED SINGLE VLC VIDEO PLAYER (Seamless transition between Inline and Fullscreen) */}
        <View style={isFullscreen ? styles.fullscreenPlayerWrapper : styles.playerContainer}>
          {isPlayerActive ? (
            <View style={isFullscreen ? styles.fullscreenPlayerBox : styles.playerBox}>
              {playbackError && !isLoadingStream ? (
                <View style={styles.playbackErrorContainer}>
                  <Ionicons name="alert-circle-outline" size={scale(44)} color="#ef4444" style={{ marginBottom: verticalScale(10) }} />
                  <Text style={styles.playbackErrorTitle}>Playback Error</Text>
                  <Text style={styles.playbackErrorMessage}>{playbackError}</Text>
                  <View style={styles.playbackErrorActions}>
                    <TouchableOpacity
                      style={styles.playbackErrorRetryBtn}
                      activeOpacity={0.8}
                      delayPressIn={0}
                      onPress={() => executeScrapeAndPlay(selectedSerial, selectedDay, activeServerId, currentCalendarDate)}
                    >
                      <Ionicons name="refresh" size={scale(15)} color="#ffffff" style={{ marginRight: scale(5) }} />
                      <Text style={styles.playbackErrorBtnText}>Retry</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.playbackErrorSwitchBtn}
                      activeOpacity={0.8}
                      delayPressIn={0}
                      onPress={togglePlayerServer}
                    >
                      <Ionicons name="swap-horizontal" size={scale(15)} color="#38bdf8" style={{ marginRight: scale(5) }} />
                      <Text style={[styles.playbackErrorBtnText, { color: '#38bdf8' }]}>
                        Switch to {activeServerId === 'tamildhool' ? 'Server 2' : 'Server 1'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls}>
                  {activeStreamSource ? (
                    <VLCPlayerView
                      key={`${activeServerId}_${currentStreamUrl || 'default'}`}
                      ref={vlcPlayerRef}
                      source={activeStreamSource}
                      autoplay={true}
                      paused={!isPlaying}
                      muted={isMuted}
                      rate={playbackSpeed}
                      resizeMode={contentFitMode === 'cover' ? 'cover' : 'contain'}
                      style={StyleSheet.absoluteFill}
                      progressUpdateInterval={500}
                      showNowPlaying={false}
                      continueAudioInBackground={false}
                      onLoadStart={() => {
                        setIsBuffering(true);
                      }}
                      onLoad={(event) => {
                        if (bufferingTimeoutRef.current) clearTimeout(bufferingTimeoutRef.current);
                        setIsBuffering(false);
                        setIsLoadingStream(false);
                        if (typeof event?.duration === 'number' && event.duration > 0) {
                          setPlaybackDuration(event.duration);
                        }
                      }}
                      onProgress={(event) => {
                        if (!isScrubbingRef.current) {
                          const cur = event?.currentTime;
                          if (typeof cur === 'number' && !isNaN(cur)) {
                            if (pendingSeekTimeRef.current !== null) {
                              const elapsed = Date.now() - lastSeekTimestampRef.current;
                              if (Math.abs(cur - pendingSeekTimeRef.current) > 3) {
                                if (elapsed < 4000) {
                                  return;
                                }
                              }
                              pendingSeekTimeRef.current = null;
                            }
                            setPlaybackTime(cur);
                          }
                          if (typeof event?.duration === 'number' && event.duration > 0) {
                            setPlaybackDuration(event.duration);
                          }
                        }
                      }}
                      onSeek={(event) => {
                        if (typeof event?.currentTime === 'number' && !isNaN(event.currentTime)) {
                          setPlaybackTime(event.currentTime);
                        }
                        pendingSeekTimeRef.current = null;
                      }}
                      onPlaying={() => {
                        if (bufferingTimeoutRef.current) clearTimeout(bufferingTimeoutRef.current);
                        setIsPlaying(true);
                        setIsBuffering(false);
                        setIsLoadingStream(false);
                      }}
                      onPaused={() => {
                        setIsPlaying(false);
                      }}
                      onBuffer={(event) => {
                        setIsBuffering(Boolean(event?.isBuffering));
                      }}
                      onError={(err) => {
                        console.warn('[VLCPlayer] Playback error:', err);
                        if (bufferingTimeoutRef.current) clearTimeout(bufferingTimeoutRef.current);
                        setIsBuffering(false);
                        setIsLoadingStream(false);
                        setPlaybackError(`Playback Error: Video stream could not be loaded. Try switching to ${activeServerId === 'tamildhool' ? 'Server 2' : 'Server 1'}.`);
                      }}
                      onEnd={() => {
                        setIsPlaying(false);
                      }}
                    />
                  ) : null}

                  {/* Floating Centered Buffering Spinner */}
                  {isBuffering && !controlsVisible && !isLoadingStream && (
                    <View pointerEvents="none" style={styles.floatingBufferingContainer}>
                      <View style={styles.floatingBufferingCircle}>
                        <ActivityIndicator size={isFullscreen ? 'large' : 'small'} color="#38bdf8" />
                      </View>
                    </View>
                  )}

                {/* Live Scraper Resolving Loader Overlay */}
                {isLoadingStream && (
                  <View style={styles.scraperLoaderOverlay} pointerEvents="auto">
                    <View style={styles.scraperLoaderCard}>
                      <ActivityIndicator size="large" color="#38bdf8" />
                      <View style={styles.scraperQueryBadge}>
                        <Ionicons name="search" size={scale(13)} color="#38bdf8" style={{ marginRight: scale(5) }} />
                        <Text style={styles.scraperQueryBadgeText}>
                          {activeServerId === 'tamilgun' ? 'Server 2 Search' : 'Server 1 Search'}
                        </Text>
                      </View>
                      <Text style={styles.scraperQueryText} numberOfLines={2}>
                        {activeMetadataQuery || buildMetadataString(selectedSerial, selectedDay, currentCalendarDate, activeServerId)}
                      </Text>
                      <Text style={styles.scraperSubText}>
                        Posting stream with HTTP Referer to VLC Player Engine
                      </Text>
                    </View>
                  </View>
                )}

                {/* CONTROLS OVERLAY (Matching MovieDetailScreen VLC Player UI/UX Layout) */}
                {!isLoadingStream && (
                  <Animated.View
                    pointerEvents={controlsVisible ? 'box-none' : 'none'}
                    style={[
                      StyleSheet.absoluteFill,
                      styles.vlcControlsOverlay,
                      isFullscreen ? styles.fullscreenControlsPadding : null,
                      { opacity: controlsOpacity }
                    ]}
                  >
                    {/* Top Row: Back button (Minimizes if in fullscreen, stops if normal) + Title/Date + Server badge + Aspect Ratio + Fullscreen */}
                    <View style={styles.vlcTopBar}>
                      <View style={styles.vlcTopLeft}>
                        <TouchableOpacity
                          style={[styles.vlcCircularBtn, isFullscreen ? { width: scale(40), height: scale(40), borderRadius: scale(20) } : null]}
                          onPress={() => {
                            if (isFullscreen) {
                              toggleFullscreen();
                            } else {
                              setIsPlaying(false);
                              setIsPlayerActive(false);
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="arrow-back" size={isFullscreen ? scale(20) : scale(16)} color="#ffffff" />
                        </TouchableOpacity>
                        <View style={{ marginLeft: scale(8), flex: 1 }}>
                          <Text style={[styles.vlcTitleText, isFullscreen ? { fontSize: moderateScale(16) } : null]} numberOfLines={1}>
                            {selectedSerial?.title || 'Tamil Serial'}
                          </Text>
                          <Text style={[styles.vlcSubtitleText, isFullscreen ? { fontSize: moderateScale(12) } : null]} numberOfLines={1}>
                            {selectedDay} {monthName} {year} • {activeServer.displayName}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.vlcTopRight}>
                        {/* Quick Server Switcher Badge Pill */}
                        <TouchableOpacity
                          style={[styles.vlcServerBadgePill, isFullscreen ? { height: scale(32), paddingHorizontal: scale(10) } : null]}
                          onPress={togglePlayerServer}
                          activeOpacity={0.8}
                        >
                          <View style={styles.vlcServerDot} />
                          <Text style={[styles.vlcServerBadgeText, isFullscreen ? { fontSize: moderateScale(11) } : null]}>
                            {activeServer.displayName}
                          </Text>
                        </TouchableOpacity>

                        {/* Aspect Ratio Mode */}
                        <TouchableOpacity
                          style={[styles.vlcCircularBtn, isFullscreen ? { width: scale(40), height: scale(40), borderRadius: scale(20) } : null]}
                          onPress={toggleContentFitMode}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons
                            name={contentFitMode === 'cover' ? 'aspect-ratio' : 'fit-to-screen'}
                            size={isFullscreen ? scale(18) : scale(16)}
                            color={contentFitMode === 'cover' ? '#38bdf8' : '#ffffff'}
                          />
                        </TouchableOpacity>

                        {/* Fullscreen Toggle Button */}
                        <TouchableOpacity
                          style={[styles.vlcCircularBtn, isFullscreen ? { width: scale(40), height: scale(40), borderRadius: scale(20) } : null]}
                          onPress={toggleFullscreen}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons
                            name={isFullscreen ? "fullscreen-exit" : "fullscreen"}
                            size={isFullscreen ? scale(20) : scale(16)}
                            color="#ffffff"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Center Controls: Rewind 10s, Big Play/Pause, Forward 10s */}
                    <View style={[styles.vlcCenterControls, isFullscreen ? { gap: scale(48) } : null]}>
                      <TouchableOpacity
                        onPress={() => handleSeek(-10)}
                        activeOpacity={0.75}
                        style={[styles.vlcSkipBtn, isFullscreen ? { width: scale(52), height: scale(52), borderRadius: scale(26) } : null]}
                      >
                        <MaterialIcons name="replay-10" size={isFullscreen ? scale(28) : scale(22)} color="#ffffff" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setIsPlaying(prev => !prev)}
                        activeOpacity={0.85}
                        style={[styles.vlcPlayPauseBtn, isFullscreen ? { width: scale(68), height: scale(68), borderRadius: scale(34) } : null]}
                      >
                        {isBuffering ? (
                          <ActivityIndicator size={isFullscreen ? "large" : "small"} color="#0284c7" />
                        ) : (
                          <Ionicons
                            name={isPlaying ? 'pause' : 'play'}
                            size={isFullscreen ? scale(34) : scale(26)}
                            color="#000000"
                            style={!isPlaying ? { marginLeft: scale(3) } : null}
                          />
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleSeek(10)}
                        activeOpacity={0.75}
                        style={[styles.vlcSkipBtn, isFullscreen ? { width: scale(52), height: scale(52), borderRadius: scale(26) } : null]}
                      >
                        <MaterialIcons name="forward-10" size={isFullscreen ? scale(28) : scale(22)} color="#ffffff" />
                      </TouchableOpacity>
                    </View>

                    {/* Bottom Row: Scrubber, Timestamps & Feature Toolbar */}
                    <View style={styles.vlcBottomContainer}>
                      {/* Scrubber Progress Bar */}
                      <View
                        style={[styles.vlcScrubberTouchArea, isFullscreen ? { height: verticalScale(32) } : null]}
                        onLayout={(e) => {
                          const w = e.nativeEvent.layout.width;
                          scrubberWidthRef.current = w;
                          setScrubberWidth(w);
                        }}
                        {...scrubberPanResponder.panHandlers}
                      >
                        <View pointerEvents="none" style={[styles.vlcScrubberTrack, isFullscreen ? { height: verticalScale(4.5) } : null]}>
                          <View
                            pointerEvents="none"
                            style={[
                              styles.vlcScrubberFill,
                              { width: `${Math.min(100, Math.max(0, (playbackTime / ((typeof playbackDuration === 'number' && playbackDuration > 0) ? playbackDuration : 1320)) * 100))}%` }
                            ]}
                          />
                          <View
                            pointerEvents="none"
                            style={[
                              styles.vlcScrubberThumb,
                              isFullscreen ? { width: scale(14), height: scale(14), borderRadius: scale(7), top: verticalScale(-4.75) } : null,
                              { left: `${Math.min(100, Math.max(0, (playbackTime / ((typeof playbackDuration === 'number' && playbackDuration > 0) ? playbackDuration : 1320)) * 100))}%` }
                            ]}
                          />
                        </View>
                      </View>

                      {/* Timestamps */}
                      <View style={styles.vlcTimestampsRow}>
                        <Text style={[styles.vlcTimeTextLeft, isFullscreen ? { fontSize: moderateScale(12) } : null]}>{formatTime(playbackTime)}</Text>
                        <Text style={[styles.vlcTimeTextRight, isFullscreen ? { fontSize: moderateScale(12) } : null]}>
                          {formatTime((typeof playbackDuration === 'number' && playbackDuration > 0) ? playbackDuration : 1320)}
                        </Text>
                      </View>

                      {/* Features Row */}
                      <View style={[styles.vlcFeaturesRow, isFullscreen ? { marginTop: verticalScale(10), gap: scale(14) } : null]}>
                        {/* Server Switcher Pill */}
                        <TouchableOpacity
                          onPress={togglePlayerServer}
                          activeOpacity={0.8}
                          style={[styles.vlcFeatureBtnPill, isFullscreen ? { height: scale(34), paddingHorizontal: scale(14) } : null]}
                        >
                          <MaterialCommunityIcons name="server-network" size={scale(13)} color="#38bdf8" style={{ marginRight: scale(4) }} />
                          <Text style={[styles.vlcFeatureBtnText, isFullscreen ? { fontSize: moderateScale(12) } : null]}>{activeServer.displayName}</Text>
                        </TouchableOpacity>

                        {/* Playback Speed */}
                        <TouchableOpacity
                          onPress={cyclePlaybackSpeed}
                          activeOpacity={0.8}
                          style={[styles.vlcFeatureBtn, isFullscreen ? { width: scale(34), height: scale(34), borderRadius: scale(17) } : null]}
                        >
                          <Text style={[styles.vlcSpeedText, isFullscreen ? { fontSize: moderateScale(12) } : null]}>{playbackSpeed}x</Text>
                        </TouchableOpacity>

                        {/* Aspect Ratio */}
                        <TouchableOpacity
                          onPress={toggleContentFitMode}
                          activeOpacity={0.8}
                          style={[styles.vlcFeatureBtn, isFullscreen ? { width: scale(34), height: scale(34), borderRadius: scale(17) } : null]}
                        >
                          <MaterialCommunityIcons
                            name={contentFitMode === 'cover' ? 'aspect-ratio' : 'fit-to-screen'}
                            size={isFullscreen ? scale(18) : scale(15)}
                            color={contentFitMode === 'cover' ? '#38bdf8' : '#ffffff'}
                          />
                        </TouchableOpacity>

                        {/* Audio Mute */}
                        <TouchableOpacity
                          onPress={toggleMute}
                          activeOpacity={0.8}
                          style={[styles.vlcFeatureBtn, isFullscreen ? { width: scale(34), height: scale(34), borderRadius: scale(17) } : null]}
                        >
                          <Ionicons
                            name={isMuted ? 'volume-mute' : 'volume-high'}
                            size={isFullscreen ? scale(18) : scale(15)}
                            color={isMuted ? '#f87171' : '#ffffff'}
                          />
                        </TouchableOpacity>

                        {/* Fullscreen Toggle / Exit */}
                        <TouchableOpacity
                          onPress={toggleFullscreen}
                          activeOpacity={0.8}
                          style={[styles.vlcFeatureBtn, isFullscreen ? { width: scale(34), height: scale(34), borderRadius: scale(17) } : null]}
                        >
                          <MaterialCommunityIcons
                            name={isFullscreen ? "fullscreen-exit" : "fullscreen"}
                            size={isFullscreen ? scale(18) : scale(15)}
                            color="#ffffff"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Animated.View>
                )}
              </Pressable>
              )}
            </View>
          ) : (
            /* Decryptor Status Circles Hero matching attached image */
            <LinearGradient
              colors={['#080b14', '#0d1322', '#090d18']}
              style={styles.nodesHeroGradient}
            >
              <View style={styles.nodesRow}>
                {/* Node 1: Tamil Server Source */}
                <View style={styles.nodeItem}>
                  <View style={styles.nodeCircle}>
                    <Ionicons name="server-outline" size={scale(22)} color="#94a3b8" />
                  </View>
                  <Text style={styles.nodeLabel}>Tamil Server Source</Text>
                  <Text style={styles.nodeSubLabel}>{activeServer.name}</Text>
                </View>

                {/* Node 2: Client Decryptor Engine (Prominent center) */}
                <View style={[styles.nodeItem, { marginTop: verticalScale(14) }]}>
                  <View style={[styles.nodeCircle, styles.nodeCircleActive]}>
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                      <Ionicons name="layers-outline" size={scale(26)} color="#38bdf8" />
                    </Animated.View>
                  </View>
                  <Text style={[styles.nodeLabel, { color: '#ffffff' }]}>Client Decryptor Engine</Text>
                  <Text style={[styles.nodeSubLabel, { color: '#38bdf8' }]}>Active Decryptor</Text>
                </View>

                {/* Node 3: Stream Output Sandbox */}
                <View style={styles.nodeItem}>
                  <View style={styles.nodeCircle}>
                    <Ionicons name="videocam-outline" size={scale(22)} color="#94a3b8" />
                  </View>
                  <Text style={styles.nodeLabel}>Stream Output Sandbox</Text>
                  <Text style={styles.nodeSubLabel}>HLS Output</Text>
                </View>
              </View>
            </LinearGradient>
          )}
        </View>

        {/* LOWER SCROLLABLE UI (Step 1, 2, 3) - Only rendered when not in fullscreen */}
        {!isFullscreen && (
          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.detailScrollContent}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            scrollEventThrottle={16}
            delaysContentTouches={false}
            keyboardShouldPersistTaps="handled"
            canCancelContentTouches={true}
          >

          {/* Active Scraper Metadata Query Bar matching user format: Title | DD-MM-YYYY | Channel Serial */}
          <View style={styles.metadataQueryBanner}>
            <View style={styles.metadataQueryLeft}>
              <Ionicons name="pulse" size={scale(16)} color="#38bdf8" style={{ marginRight: scale(6) }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.metadataQueryLabel}>Server Scraper Metadata Query</Text>
                <Text style={styles.metadataQueryValue} numberOfLines={1}>
                  {buildMetadataString(selectedSerial, selectedDay, currentCalendarDate, activeServerId)}
                </Text>
              </View>
            </View>
            <View style={styles.metadataEngineBadge}>
              <Ionicons name="play" size={scale(10)} color="#22c55e" style={{ marginRight: scale(3) }} />
              <Text style={styles.metadataEngineBadgeText}>VLC Player Engine</Text>
            </View>
          </View>

          {/* ========================================================== */}
          {/* STEP 1, 2, 3 SECTION                                       */}
          {/* ========================================================== */}
          <View style={styles.stepsContainer}>
            {/* STEP 1: BUTTONS SERVER 1 & SERVER 2 - CHANNELS REMOVED */}
            <View style={styles.stepSection}>
              <Text style={styles.stepHeaderTitle}>Step 1: Select Server</Text>

              <View style={styles.serversRow}>
                {SERVERS.map((srv) => {
                  const isSelected = activeServerId === srv.id;
                  return (
                    <TouchableOpacity
                      key={srv.id}
                      style={[
                        styles.serverSelectButton,
                        isSelected ? styles.serverSelectButtonActive : styles.serverSelectButtonInactive
                      ]}
                      activeOpacity={0.7}
                      delayPressIn={0}
                      onPress={() => {
                        setActiveServerId(srv.id);
                        executeScrapeAndPlay(selectedSerial, selectedDay, srv.id, currentCalendarDate);
                      }}
                    >
                      <Ionicons
                        name={isSelected ? 'shield-checkmark' : 'server-outline'}
                        size={scale(16)}
                        color={isSelected ? '#ffffff' : '#374151'}
                        style={{ marginRight: scale(6) }}
                      />
                      <Text
                        style={[
                          styles.serverSelectButtonText,
                          isSelected ? styles.serverSelectButtonTextActive : styles.serverSelectButtonTextInactive
                        ]}
                        numberOfLines={1}
                      >
                        {srv.displayName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* STEP 2: ALL SERIAL NAMES - EASY TO SELECT DROPDOWN LIST */}
            <View style={[styles.stepSection, { marginTop: verticalScale(16) }]}>
              <Text style={styles.stepHeaderTitle}>Step 2: Select Tamil Serial</Text>

              <TouchableOpacity
                style={styles.dropdownBox}
                activeOpacity={0.7}
                delayPressIn={0}
                onPress={() => setDropdownVisible(true)}
              >
                <View style={styles.dropdownLeft}>
                  <ChannelLogo channelCode={selectedSerial?.channelCode} size={scale(16)} style={{ marginRight: scale(8) }} />
                  <Text style={styles.dropdownSelectedText} numberOfLines={1}>
                    {selectedSerial?.title} {selectedSerial?.timeSlot ? `(${selectedSerial.timeSlot})` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={scale(18)} color="#4b5563" />
              </TouchableOpacity>

              <Text style={styles.archiveSubtitle}>
                Available archive tracks: {selectedSerial?.episodesCount || '1240 episodes logged'}.
              </Text>
            </View>

            {/* STEP 3: SELECT BROADCAST PRODUCTION DATE (CALENDAR) */}
            <View style={[styles.stepSection, { marginTop: verticalScale(18) }]}>
              <View style={styles.calendarHeaderRow}>
                <Text style={styles.stepHeaderTitle}>Step 3: Select Broadcast Production Date</Text>

                <View style={styles.monthNav}>
                  <TouchableOpacity onPress={prevMonth} style={styles.monthNavBtn} activeOpacity={0.7} delayPressIn={0}>
                    <Ionicons name="chevron-back" size={scale(14)} color="#374151" />
                  </TouchableOpacity>
                  <Text style={styles.monthNavLabel}>{monthName} {year}</Text>
                  <TouchableOpacity onPress={nextMonth} style={styles.monthNavBtn} activeOpacity={0.7} delayPressIn={0}>
                    <Ionicons name="chevron-forward" size={scale(14)} color="#374151" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Calendar Grid matching screenshot */}
              <View style={styles.calendarCard}>
                <View style={styles.calendarWeekRow}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w, idx) => (
                    <View key={`wk-${idx}`} style={styles.calendarWeekCell}>
                      <Text style={styles.calendarWeekText}>{w}</Text>
                    </View>
                  ))}
                </View>

                {/* 7-column calendar rows to prevent flexWrap distortion */}
                {calendarRows.map((row, rIdx) => (
                  <View key={`cal-row-${rIdx}`} style={styles.calendarRow}>
                    {row.map((item) => {
                      if (item.day === null) {
                        return <View key={item.key} style={styles.emptyGridCell} />;
                      }

                      const isSelected = selectedDay === item.day;
                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={[
                            styles.gridDayCell,
                            isSelected && styles.gridDayCellActive
                          ]}
                          activeOpacity={0.7}
                          delayPressIn={0}
                          onPress={() => {
                            setSelectedDay(item.day);
                            executeScrapeAndPlay(selectedSerial, item.day, activeServerId, currentCalendarDate);
                          }}
                        >
                          <Text
                            style={[
                              styles.gridDayText,
                              isSelected && styles.gridDayTextActive
                            ]}
                          >
                            {item.day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>
        )}

        {/* MODAL DROPDOWN: ALL SERIAL NAMES */}
        <Modal
          visible={dropdownVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDropdownVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setDropdownVisible(false)}
          >
            <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalSheetTitle}>Select Tamil Serial</Text>
                  <Text style={styles.modalSheetSubtitle}>
                    {activeServer.displayName} • {allServerSerials.length} Serials Logged
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDropdownVisible(false)}
                  style={styles.modalCloseBtn}
                >
                  <Ionicons name="close" size={scale(20)} color="#374151" />
                </TouchableOpacity>
              </View>

              <View style={styles.searchBar}>
                <Ionicons name="search" size={scale(16)} color="#6b7280" style={{ marginRight: scale(6) }} />
                <TextInput
                  placeholder="Search serial name or time..."
                  placeholderTextColor="#9ca3af"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchInput}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={scale(16)} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView style={{ maxHeight: verticalScale(340) }} showsVerticalScrollIndicator={false}>
                {filteredDropdownSerials.map((s) => {
                  const isSelected = selectedSerial?.id === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      style={({ pressed }) => [
                        styles.serialOptionItem,
                        isSelected && styles.serialOptionItemActive,
                        pressed && { opacity: 0.7 }
                      ]}
                      hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                      onPress={() => {
                        setSelectedSerial(s);
                        setDropdownVisible(false);
                        setSearchQuery('');
                        executeScrapeAndPlay(s, selectedDay, activeServerId, currentCalendarDate);
                      }}
                    >
                      <View style={styles.serialOptionLeft}>
                        <ChannelLogo channelCode={s.channelCode} size={scale(20)} style={{ marginRight: scale(10) }} />
                        <View>
                          <Text style={[styles.serialOptionTitle, isSelected && styles.serialOptionTitleActive]}>
                            {s.title}
                          </Text>
                          <Text style={styles.serialOptionMeta}>
                            {s.tamilTitle} • {s.channel} • {s.timeSlot}
                          </Text>
                        </View>
                      </View>

                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={scale(20)} color="#2563eb" />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  // ==============================================================
  // VIEW 1: HOME PAGE OF TV SERIALS (Catalog matching attached design)
  // ==============================================================
  return (
    <View style={[styles.homeScreenContainer, { paddingTop: topNotchPadding }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        scrollEventThrottle={16}
        delaysContentTouches={false}
        keyboardShouldPersistTaps="handled"
        canCancelContentTouches={true}
      >
        {/* 1. TOP HERO BANNER (Pixel-perfect matching attached reference) */}
        <View style={styles.heroOuterWrapper}>
          <ImageBackground
            source={{ uri: currentHero.image }}
            style={styles.heroCard}
            imageStyle={styles.heroCardImageStyle}
            resizeMode="cover"
          >
            {/* Dark gradient overlay for text readability */}
            <LinearGradient
              colors={['rgba(7, 10, 19, 0.35)', 'rgba(7, 10, 19, 0.72)', '#070a13']}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFillObject}
            />

            {/* Top Row: Pill Tag (☀️ SUN TV • PRIME) + Pause/Play Button */}
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroPrimeBadge}>
                <Ionicons
                  name={currentHero.channelCode === 'sun' ? 'sunny' : currentHero.channelCode === 'vijay' ? 'star' : 'tv'}
                  size={scale(12)}
                  color="#facc15"
                  style={{ marginRight: scale(5) }}
                />
                <Text style={styles.heroPrimeBadgeText}>
                  {currentHero.tag === 'Prime Show' ? '★ PRIME SHOW' : (currentHero.networkTag || `${currentHero.channel.toUpperCase()} • PRIME`)}
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.pauseCircleBtn,
                  pressed && { opacity: 0.7 }
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setIsHeroPaused((prev) => !prev)}
              >
                <Ionicons
                  name={isHeroPaused ? 'play' : 'pause'}
                  size={scale(15)}
                  color="#ffffff"
                />
              </Pressable>
            </View>

            {/* Hero Main Content Row */}
            <View style={styles.heroMainRow}>
              {/* Left Info Column */}
              <View style={styles.heroInfoColumn}>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {currentHero.title}
                </Text>
                <Text style={styles.heroTamilTitle} numberOfLines={1}>
                  {currentHero.tamilTitle}
                </Text>

                {/* Metadata row: Time Slot + Daily Soap Tag */}
                <View style={styles.heroMetaRow}>
                  <View style={styles.heroTimeSlotBadge}>
                    <Ionicons name="time-outline" size={scale(11)} color="#94a3b8" style={{ marginRight: scale(4) }} />
                    <Text style={styles.heroTimeSlotText}>{currentHero.timeSlot || '07:30 PM'}</Text>
                  </View>
                  <View style={styles.heroCategoryPill}>
                    <Text style={styles.heroCategoryPillText}>{currentHero.tag || 'Daily Soap'}</Text>
                  </View>
                </View>

                {/* Quick Play Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.quickPlayButton,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => handleOpenDetailScreen(currentHero)}
                >
                  <Ionicons name="play" size={scale(14)} color="#ffffff" style={{ marginRight: scale(6) }} />
                  <Text style={styles.quickPlayText}>Quick Play</Text>
                </Pressable>
              </View>

              {/* Right: Floating Picture-in-Picture Video Preview Card with 🟢 HD badge */}
              <View style={styles.heroPipContainer}>
                <View style={styles.heroPipCard}>
                  <Image
                    source={{ uri: currentHero.image }}
                    style={styles.heroPipImage}
                    resizeMode="cover"
                  />
                  <View style={styles.heroPipHdBadge}>
                    <View style={styles.heroPipGreenDot} />
                    <Text style={styles.heroPipHdText}>HD</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Bottom-left Carousel Pagination Dots */}
            <View style={styles.paginationRow}>
              {heroHighlights.map((_, index) => {
                const isActive = index === heroIndex;
                return (
                  <Pressable
                    key={`dot-${index}`}
                    onPress={() => setHeroIndex(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={({ pressed }) => [
                      isActive ? styles.paginationPillActive : styles.paginationDotInactive,
                      pressed && { opacity: 0.5 }
                    ]}
                  />
                );
              })}
            </View>
          </ImageBackground>
        </View>

        {/* 2. PRIMARY BROADCASTERS / சேனல்கள் */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleWithIcon}>
            <Ionicons name="tv" size={scale(18)} color="#3b82f6" style={{ marginRight: scale(8) }} />
            <Text style={styles.sectionHeaderTitle}>Primary Broadcasters / சேனல்கள்</Text>
          </View>
          <View style={styles.liveSyncedBadge}>
            <Ionicons name="flash" size={scale(11)} color="#facc15" style={{ marginRight: scale(4) }} />
            <Text style={styles.liveSyncedText}>Live Synced (88)</Text>
          </View>
        </View>

        {/* 3 White Broadcaster Cards in horizontal row */}
        <View style={styles.broadcastersRow}>
          {CHANNELS.map((broadcaster) => {
            const isSelected = homeChannelFilter === broadcaster.id;
            return (
              <Pressable
                key={broadcaster.id}
                style={({ pressed }) => [
                  styles.whiteBroadcasterCard,
                  isSelected && styles.whiteBroadcasterCardSelected,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }
                ]}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                onPress={() => {
                  if (homeChannelFilter === broadcaster.id) {
                    setHomeChannelFilter('all');
                  } else {
                    setHomeChannelFilter(broadcaster.id);
                  }
                }}
              >
                <View style={styles.broadcasterCardIconWrap}>
                  {broadcaster.code === 'sun' && (
                    <Ionicons name="sunny" size={scale(22)} color="#f59e0b" />
                  )}
                  {broadcaster.code === 'vijay' && (
                    <FontAwesome5 name="star" size={scale(18)} color="#ef4444" />
                  )}
                  {broadcaster.code === 'zee' && (
                    <MaterialCommunityIcons name="weather-sunset-up" size={scale(22)} color="#a855f7" />
                  )}
                </View>
                <View style={styles.broadcasterCardTextWrap}>
                  <Text style={styles.broadcasterCardName}>{broadcaster.name}</Text>
                  <Text style={styles.broadcasterCardTamilName}>{broadcaster.tamilName}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* 3. TRENDING DAILY SERIALS / தொடர்கள் */}
        <View style={[styles.sectionHeaderRow, { marginTop: verticalScale(18) }]}>
          <View style={styles.sectionTitleWithIcon}>
            <Ionicons name="trending-up" size={scale(18)} color="#ef4444" style={{ marginRight: scale(8) }} />
            <Text style={styles.sectionHeaderTitle}>Trending Daily Serials / தொடர்கள்</Text>
          </View>
        </View>

        <View style={styles.cardsGridContainer}>
          {homeFilteredSerials.map((serial) => (
            <Pressable
              key={serial.id}
              style={({ pressed }) => [
                styles.serialGridCardWrapper,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }
              ]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              onPress={() => handleOpenDetailScreen(serial)}
            >
              <ImageBackground
                source={{ uri: serial.image }}
                style={styles.serialGridCardBg}
                imageStyle={styles.serialGridCardImageStyle}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={['rgba(15, 23, 42, 0.35)', 'rgba(15, 23, 42, 0.72)', '#090d16']}
                  locations={[0, 0.5, 1]}
                  style={StyleSheet.absoluteFillObject}
                />

                {/* Top row: Channel Badge + Time Slot */}
                <View style={styles.gridCardTopRow}>
                  <View style={styles.gridPill}>
                    <Ionicons 
                      name={serial.channelCode === 'sun' ? 'sunny' : serial.channelCode === 'vijay' ? 'star' : 'tv'} 
                      size={scale(10)} 
                      color={serial.channelCode === 'sun' ? '#f59e0b' : serial.channelCode === 'vijay' ? '#ef4444' : '#a855f7'} 
                      style={{ marginRight: scale(4) }} 
                    />
                    <Text style={styles.gridPillText}>{serial.channel}</Text>
                  </View>
                  <View style={styles.gridPill}>
                    <Text style={styles.gridPillText}>{serial.timeSlot}</Text>
                  </View>
                </View>

                {/* Bottom: Title + Tamil Subtitle + Meta */}
                <View style={styles.gridCardBottomContent}>
                  <Text style={styles.gridCardTitleText} numberOfLines={1}>
                    {serial.title}
                  </Text>
                  <Text style={styles.gridCardTamilTitleText} numberOfLines={1}>
                    {serial.tamilTitle}
                  </Text>
                  <View style={styles.gridCardMetaRow}>
                    <Text style={styles.gridCardMetaLeft}>{serial.episodes}</Text>
                    <Text style={styles.gridCardMetaRight}>{serial.tag || 'Daily Soap'}</Text>
                  </View>
                </View>
              </ImageBackground>
            </Pressable>
          ))}
        </View>

        {/* 4. POPULAR REALITY SHOWS / நிகழ்ச்சிகள் */}
        <View style={styles.realityHeaderWrapper}>
          <Text style={styles.sectionHeaderTitleCentered}>Popular Reality Shows / நிகழ்ச்சிகள்</Text>
        </View>

        <View style={styles.cardsGridContainer}>
          {homeFilteredReality.map((show) => (
            <Pressable
              key={show.id}
              style={({ pressed }) => [
                styles.serialGridCardWrapper,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }
              ]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              onPress={() => handleOpenDetailScreen(show)}
            >
              <ImageBackground
                source={{ uri: show.image }}
                style={styles.serialGridCardBg}
                imageStyle={styles.serialGridCardImageStyle}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={['rgba(26, 14, 42, 0.35)', 'rgba(26, 14, 42, 0.75)', '#110a1f']}
                  locations={[0, 0.5, 1]}
                  style={StyleSheet.absoluteFillObject}
                />

                {/* Top row: Channel Badge + Air Slot */}
                <View style={styles.gridCardTopRow}>
                  <View style={styles.gridPill}>
                    <Ionicons 
                      name={show.channelCode === 'sun' ? 'sunny' : show.channelCode === 'vijay' ? 'star' : 'tv'} 
                      size={scale(10)} 
                      color={show.channelCode === 'sun' ? '#f59e0b' : show.channelCode === 'vijay' ? '#ef4444' : '#a855f7'} 
                      style={{ marginRight: scale(4) }} 
                    />
                    <Text style={styles.gridPillText}>{show.channel}</Text>
                  </View>
                  <View style={[styles.gridPill, show.tag === 'Prime Show' ? { backgroundColor: 'rgba(239, 68, 68, 0.4)' } : null]}>
                    <Text style={[styles.gridPillText, show.tag === 'Prime Show' ? { color: '#fca5a5', fontWeight: '800' } : null]}>
                      {show.tag === 'Prime Show' ? 'Prime Show' : 'Weekend'}
                    </Text>
                  </View>
                </View>

                {/* Center / Bottom: Title + Tamil Subtitle */}
                <View style={styles.gridCardBottomContent}>
                  <Text style={styles.gridCardTitleText} numberOfLines={1}>
                    {show.title}
                  </Text>
                  <Text style={[styles.gridCardTamilTitleText, { color: show.tamilColor || '#818cf8' }]} numberOfLines={1}>
                    {show.tamilTitle}
                  </Text>
                  <View style={styles.gridCardMetaRow}>
                    <Text style={styles.gridCardMetaLeft}>{show.genre}</Text>
                    <Text style={styles.gridCardMetaRight}>{show.timeSlot}</Text>
                  </View>
                </View>
              </ImageBackground>
            </Pressable>
          ))}
        </View>

        {/* 5. TV PROGRAMMES / தொலைக்காட்சி நிகழ்ச்சிகள் */}
        <View style={styles.realityHeaderWrapper}>
          <Text style={styles.sectionHeaderTitleCentered}>TV Programmes / தொலைக்காட்சி நிகழ்ச்சிகள்</Text>
        </View>

        <View style={styles.cardsGridContainer}>
          {homeFilteredProgrammes.map((prg) => (
            <Pressable
              key={prg.id}
              style={({ pressed }) => [
                styles.serialGridCardWrapper,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }
              ]}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              onPress={() => handleOpenDetailScreen(prg)}
            >
              <ImageBackground
                source={{ uri: prg.image }}
                style={styles.serialGridCardBg}
                imageStyle={styles.serialGridCardImageStyle}
                resizeMode="cover"
              >
                <LinearGradient
                  colors={['rgba(15, 23, 42, 0.35)', 'rgba(15, 23, 42, 0.72)', '#090d16']}
                  locations={[0, 0.5, 1]}
                  style={StyleSheet.absoluteFillObject}
                />

                {/* Top row: Channel Badge + Genre Tag */}
                <View style={styles.gridCardTopRow}>
                  <View style={styles.gridPill}>
                    <Ionicons 
                      name={prg.channelCode === 'sun' ? 'sunny' : prg.channelCode === 'vijay' ? 'star' : 'tv'} 
                      size={scale(10)} 
                      color={prg.channelCode === 'sun' ? '#f59e0b' : prg.channelCode === 'vijay' ? '#ef4444' : '#a855f7'} 
                      style={{ marginRight: scale(4) }} 
                    />
                    <Text style={styles.gridPillText}>{prg.channel}</Text>
                  </View>
                  <View style={styles.gridPill}>
                    <Text style={styles.gridPillText}>{prg.tag || 'Special'}</Text>
                  </View>
                </View>

                {/* Bottom: Title + Tamil Subtitle */}
                <View style={styles.gridCardBottomContent}>
                  <Text style={styles.gridCardTitleText} numberOfLines={1}>
                    {prg.title}
                  </Text>
                  <Text style={[styles.gridCardTamilTitleText, { color: prg.tamilColor || '#38bdf8' }]} numberOfLines={1}>
                    {prg.tamilTitle}
                  </Text>
                  <View style={styles.gridCardMetaRow}>
                    <Text style={styles.gridCardMetaLeft}>{prg.genre}</Text>
                    <Text style={styles.gridCardMetaRight}>{prg.timeSlot || 'Weekly'}</Text>
                  </View>
                </View>
              </ImageBackground>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  homeScreenContainer: {
    flex: 1,
    backgroundColor: '#080c14',
  },
  detailScreenContainer: {
    flex: 1,
    backgroundColor: '#080c14',
  },
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  scrollContent: {
    paddingBottom: verticalScale(90),
  },

  // Detail Navigation Bar
  detailNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(14),
    paddingVertical: verticalScale(10),
    backgroundColor: '#080c14',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  detailBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailBackBtnText: {
    color: '#ffffff',
    fontSize: moderateScale(13),
    fontWeight: '700',
    marginLeft: scale(6),
  },
  detailServerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: verticalScale(4),
    paddingHorizontal: scale(10),
    borderRadius: scale(12),
  },
  detailServerBadgeText: {
    color: '#ffffff',
    fontSize: moderateScale(10.5),
    fontWeight: '700',
  },
  detailScroll: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  detailScrollContent: {
    paddingBottom: verticalScale(90),
  },

  // Video Player Area (Positioned cleanly below camera hole)
  playerContainer: {
    width: '100%',
    backgroundColor: '#000000',
  },
  playerBox: {
    width: '100%',
    height: (windowWidth * 9) / 16,
    backgroundColor: '#000000',
    position: 'relative',
    justifyContent: 'space-between',
  },
  fullscreenPlayerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    zIndex: 99999,
    elevation: 99999,
  },
  fullscreenPlayerBox: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    position: 'relative',
    justifyContent: 'space-between',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loaderText: {
    color: '#38bdf8',
    fontSize: moderateScale(12),
    fontWeight: '700',
    marginTop: verticalScale(8),
  },
  playerOverlayTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    paddingTop: verticalScale(8),
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  statusDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    marginRight: scale(5),
  },
  // VLC Player Controls Layout (Matching MovieDetailScreen UI/UX)
  vlcControlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'space-between',
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(8),
    zIndex: 40,
  },
  fullscreenControlsPadding: {
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(14),
  },
  vlcTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vlcTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: scale(8),
  },
  vlcCircularBtn: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  vlcTitleText: {
    color: '#ffffff',
    fontSize: moderateScale(13),
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  vlcSubtitleText: {
    color: '#94a3b8',
    fontSize: moderateScale(10),
    fontWeight: '600',
    marginTop: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  vlcTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  vlcServerBadgePill: {
    paddingHorizontal: scale(8),
    height: scale(28),
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  vlcServerDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: '#22c55e',
    marginRight: scale(5),
  },
  vlcServerBadgeText: {
    color: '#38bdf8',
    fontSize: moderateScale(9.5),
    fontWeight: '800',
  },
  vlcCenterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(28),
  },
  vlcSkipBtn: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vlcPlayPauseBtn: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#ffffff',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  vlcBottomContainer: {
    width: '100%',
  },
  vlcScrubberTouchArea: {
    height: verticalScale(26),
    width: '100%',
    justifyContent: 'center',
    overflow: 'visible',
  },
  vlcScrubberTrack: {
    height: verticalScale(3.5),
    backgroundColor: 'rgba(82, 82, 91, 0.85)',
    width: '100%',
    borderRadius: scale(2),
    position: 'relative',
    overflow: 'visible',
  },
  vlcScrubberFill: {
    height: '100%',
    backgroundColor: '#38bdf8',
    borderRadius: scale(2),
  },
  vlcScrubberThumb: {
    position: 'absolute',
    transform: [{ translateX: scale(-6) }],
    top: verticalScale(-4.25),
    width: scale(12),
    height: scale(12),
    borderRadius: scale(6),
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
  },
  vlcTimestampsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: verticalScale(1),
    paddingHorizontal: scale(2),
  },
  vlcTimeTextLeft: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: moderateScale(10.5),
    fontWeight: '700',
  },
  vlcTimeTextRight: {
    color: '#a1a1aa',
    fontSize: moderateScale(10.5),
    fontWeight: '700',
  },
  vlcFeaturesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(6),
    gap: scale(8),
  },
  vlcFeatureBtn: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vlcFeatureBtnPill: {
    height: scale(30),
    paddingHorizontal: scale(10),
    borderRadius: scale(15),
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vlcFeatureBtnText: {
    color: '#38bdf8',
    fontSize: moderateScale(10),
    fontWeight: '800',
  },
  vlcSpeedText: {
    color: '#ffffff',
    fontSize: moderateScale(10),
    fontWeight: '700',
  },
  floatingBufferingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 35,
  },
  floatingBufferingCircle: {
    width: scale(54),
    height: scale(54),
    borderRadius: scale(27),
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  scraperLoaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    paddingHorizontal: scale(20),
  },
  scraperLoaderCard: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  scraperQueryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: scale(12),
    paddingHorizontal: scale(10),
    paddingVertical: verticalScale(3),
    marginTop: verticalScale(12),
    marginBottom: verticalScale(6),
  },
  scraperQueryBadgeText: {
    color: '#38bdf8',
    fontWeight: '800',
    fontSize: moderateScale(10),
    textTransform: 'uppercase',
  },
  scraperQueryText: {
    color: '#ffffff',
    fontSize: moderateScale(12.5),
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: verticalScale(4),
  },
  scraperSubText: {
    color: '#94a3b8',
    fontSize: moderateScale(10),
    fontWeight: '600',
    textAlign: 'center',
  },

  // 3 Status Circles Hero Gradient
  nodesHeroGradient: {
    paddingVertical: verticalScale(22),
    paddingHorizontal: scale(12),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  nodesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
  },
  nodeItem: {
    alignItems: 'center',
    flex: 1,
  },
  nodeCircle: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  nodeCircleActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  nodeLabel: {
    color: '#cbd5e1',
    fontSize: moderateScale(10),
    fontWeight: '700',
    textAlign: 'center',
  },
  nodeSubLabel: {
    color: '#64748b',
    fontSize: moderateScale(8.5),
    fontWeight: '600',
    marginTop: verticalScale(2),
  },


  // Steps Container
  stepsContainer: {
    paddingHorizontal: scale(14),
    paddingTop: verticalScale(16),
  },
  stepSection: {
    marginBottom: verticalScale(6),
  },
  stepHeaderTitle: {
    color: '#1f2937',
    fontSize: moderateScale(13.5),
    fontWeight: '800',
    marginBottom: verticalScale(10),
  },

  // Step 1: Server Buttons (Server 1 & Server 2)
  serversRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: scale(10),
  },
  serverSelectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: verticalScale(13),
    paddingHorizontal: scale(10),
    borderRadius: scale(10),
    borderWidth: 1.2,
  },
  serverSelectButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    elevation: 3,
  },
  serverSelectButtonInactive: {
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
  },
  serverSelectButtonText: {
    fontSize: moderateScale(13),
    fontWeight: '800',
  },
  serverSelectButtonTextActive: {
    color: '#ffffff',
  },
  serverSelectButtonTextInactive: {
    color: '#1e293b',
  },

  // Step 2: Dropdown Selector
  dropdownBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.2,
    borderColor: '#cbd5e1',
    borderRadius: scale(10),
    paddingVertical: verticalScale(12),
    paddingHorizontal: scale(14),
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownSelectedText: {
    color: '#111827',
    fontSize: moderateScale(13.5),
    fontWeight: '700',
    flex: 1,
  },
  archiveSubtitle: {
    color: '#6b7280',
    fontSize: moderateScale(11),
    fontWeight: '500',
    marginTop: verticalScale(6),
  },

  // Step 3: Calendar
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(8),
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: scale(8),
    paddingVertical: verticalScale(4),
    paddingHorizontal: scale(8),
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  monthNavBtn: {
    padding: scale(4),
  },
  monthNavLabel: {
    color: '#111827',
    fontSize: moderateScale(12),
    fontWeight: '800',
    marginHorizontal: scale(6),
  },
  calendarCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: scale(12),
    padding: scale(10),
    backgroundColor: '#ffffff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(8),
    paddingHorizontal: scale(2),
  },
  calendarWeekCell: {
    flex: 1,
    alignItems: 'center',
  },
  calendarWeekText: {
    color: '#6b7280',
    fontSize: moderateScale(12),
    fontWeight: '700',
  },
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: verticalScale(5),
  },
  emptyGridCell: {
    flex: 1,
    marginHorizontal: scale(2),
    height: verticalScale(38),
  },
  gridDayCell: {
    flex: 1,
    height: verticalScale(38),
    marginHorizontal: scale(2),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: scale(8),
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  gridDayCellActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    elevation: 3,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  gridDayText: {
    color: '#1e293b',
    fontSize: moderateScale(13),
    fontWeight: '700',
  },
  gridDayTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },

  // Action Button
  actionBtnWrapper: {
    marginTop: verticalScale(22),
    alignItems: 'center',
  },
  watchStreamButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: verticalScale(14),
    borderRadius: scale(14),
    elevation: 4,
    shadowColor: '#2563eb',
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  watchStreamButtonText: {
    color: '#ffffff',
    fontSize: moderateScale(14),
    fontWeight: '900',
  },

  // Modal Dropdown Sheet
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: scale(16),
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderRadius: scale(16),
    padding: scale(16),
    maxHeight: '82%',
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: verticalScale(12),
  },
  modalSheetTitle: {
    color: '#111827',
    fontSize: moderateScale(15),
    fontWeight: '900',
  },
  modalSheetSubtitle: {
    color: '#6b7280',
    fontSize: moderateScale(11),
    fontWeight: '600',
    marginTop: verticalScale(2),
  },
  modalCloseBtn: {
    padding: scale(4),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: scale(10),
    paddingHorizontal: scale(12),
    paddingVertical: verticalScale(6),
    marginBottom: verticalScale(10),
  },
  searchInput: {
    flex: 1,
    fontSize: moderateScale(12),
    color: '#111827',
    paddingVertical: 0,
  },
  serialOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    borderRadius: scale(8),
  },
  serialOptionItemActive: {
    backgroundColor: '#eff6ff',
  },
  serialOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serialOptionTitle: {
    color: '#111827',
    fontSize: moderateScale(13),
    fontWeight: '800',
  },
  serialOptionTitleActive: {
    color: '#2563eb',
  },
  serialOptionMeta: {
    color: '#6b7280',
    fontSize: moderateScale(10.5),
    fontWeight: '600',
    marginTop: verticalScale(2),
  },

  // -------------------------------------------------------------
  // HOME PAGE STYLES (PIXEL-PERFECT MATCHING USER REFERENCE DESIGN)
  // -------------------------------------------------------------
  heroOuterWrapper: {
    paddingHorizontal: scale(14),
    marginTop: verticalScale(8),
    marginBottom: verticalScale(12),
  },
  heroCard: {
    borderRadius: scale(18),
    overflow: 'hidden',
    padding: scale(14),
    minHeight: verticalScale(195),
    justifyContent: 'space-between',
    backgroundColor: '#0b1222',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroCardImageStyle: {
    borderRadius: scale(18),
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: verticalScale(6),
  },
  heroPrimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1d4ed8',
    paddingVertical: verticalScale(4),
    paddingHorizontal: scale(10),
    borderRadius: scale(14),
  },
  heroPrimeBadgeText: {
    color: '#ffffff',
    fontSize: moderateScale(11),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pauseCircleBtn: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroInfoColumn: {
    flex: 1,
    paddingRight: scale(10),
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: moderateScale(22),
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroTamilTitle: {
    color: '#eab308',
    fontSize: moderateScale(16),
    fontWeight: '800',
    marginTop: verticalScale(2),
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: verticalScale(6),
    marginBottom: verticalScale(10),
  },
  heroTimeSlotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: verticalScale(3),
    paddingHorizontal: scale(8),
    borderRadius: scale(10),
    marginRight: scale(6),
  },
  heroTimeSlotText: {
    color: '#e2e8f0',
    fontSize: moderateScale(10.5),
    fontWeight: '700',
  },
  heroCategoryPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingVertical: verticalScale(2.5),
    paddingHorizontal: scale(8),
    borderRadius: scale(10),
  },
  heroCategoryPillText: {
    color: '#38bdf8',
    fontSize: moderateScale(10.5),
    fontWeight: '700',
  },
  quickPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: verticalScale(8),
    paddingHorizontal: scale(14),
    borderRadius: scale(20),
    alignSelf: 'flex-start',
  },
  quickPlayText: {
    color: '#ffffff',
    fontSize: moderateScale(12),
    fontWeight: '800',
  },
  heroPipContainer: {
    width: scale(96),
    height: scale(110),
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroPipCard: {
    width: scale(96),
    height: scale(110),
    borderRadius: scale(14),
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    position: 'relative',
    backgroundColor: '#111827',
  },
  heroPipImage: {
    width: '100%',
    height: '100%',
  },
  heroPipHdBadge: {
    position: 'absolute',
    top: scale(5),
    right: scale(5),
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: scale(5),
    paddingVertical: verticalScale(1.5),
    borderRadius: scale(8),
  },
  heroPipGreenDot: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(2.5),
    backgroundColor: '#22c55e',
    marginRight: scale(3),
  },
  heroPipHdText: {
    color: '#ffffff',
    fontSize: moderateScale(8.5),
    fontWeight: '900',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: verticalScale(10),
  },
  paginationPillActive: {
    width: scale(20),
    height: scale(4.5),
    borderRadius: scale(2.5),
    backgroundColor: '#38bdf8',
    marginRight: scale(5),
  },
  paginationDotInactive: {
    width: scale(4.5),
    height: scale(4.5),
    borderRadius: scale(2.5),
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    marginRight: scale(5),
  },

  // Primary Broadcasters Row (Home)
  sectionHeaderRow: {
    paddingHorizontal: scale(14),
    marginTop: verticalScale(14),
    marginBottom: verticalScale(8),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionHeaderTitle: {
    color: '#ffffff',
    fontSize: moderateScale(14.5),
    fontWeight: '800',
  },
  liveSyncedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: verticalScale(3),
    paddingHorizontal: scale(8),
    borderRadius: scale(12),
  },
  liveSyncedText: {
    color: '#4ade80',
    fontSize: moderateScale(10.5),
    fontWeight: '800',
  },
  broadcastersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: scale(14),
    marginTop: verticalScale(4),
    gap: scale(8),
  },
  whiteBroadcasterCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: verticalScale(10),
    paddingHorizontal: scale(8),
    borderRadius: scale(14),
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  whiteBroadcasterCardSelected: {
    borderColor: '#2563eb',
    borderWidth: 2,
    backgroundColor: '#f0f7ff',
  },
  broadcasterCardIconWrap: {
    marginRight: scale(6),
  },
  broadcasterCardTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  broadcasterCardName: {
    color: '#0f172a',
    fontSize: moderateScale(12.5),
    fontWeight: '800',
  },
  broadcasterCardTamilName: {
    color: '#64748b',
    fontSize: moderateScale(10),
    fontWeight: '600',
    marginTop: verticalScale(1),
  },

  // Cards Grid (Home)
  cardsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: scale(14),
    marginTop: verticalScale(6),
  },
  serialGridCardWrapper: {
    width: (windowWidth - scale(28) - scale(10)) / 2,
    height: verticalScale(175),
    borderRadius: scale(16),
    overflow: 'hidden',
    marginBottom: verticalScale(12),
    borderWidth: 1.2,
    borderColor: 'rgba(56, 189, 248, 0.22)',
    elevation: 4,
    backgroundColor: '#0b1222',
  },
  serialGridCardBg: {
    flex: 1,
    justifyContent: 'space-between',
  },
  serialGridCardImageStyle: {
    borderRadius: scale(16),
  },
  gridCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(8),
  },
  gridPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: verticalScale(2),
    paddingHorizontal: scale(6),
    borderRadius: scale(8),
  },
  gridPillText: {
    color: '#e2e8f0',
    fontSize: moderateScale(9.5),
    fontWeight: '700',
  },
  gridCardBottomContent: {
    padding: scale(8),
  },
  gridCardTitleText: {
    color: '#ffffff',
    fontSize: moderateScale(14),
    fontWeight: '800',
  },
  gridCardTamilTitleText: {
    color: '#38bdf8',
    fontSize: moderateScale(12),
    fontWeight: '700',
    marginTop: verticalScale(1),
  },
  gridCardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: verticalScale(4),
  },
  gridCardMetaLeft: {
    color: '#94a3b8',
    fontSize: moderateScale(10),
    fontWeight: '600',
  },
  gridCardMetaRight: {
    color: '#94a3b8',
    fontSize: moderateScale(10),
    fontWeight: '600',
  },

  // Section Headers for Reality & TV Programmes (Home)
  realityHeaderWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: verticalScale(18),
    marginBottom: verticalScale(8),
  },
  sectionHeaderTitleCentered: {
    color: '#ffffff',
    fontSize: moderateScale(15),
    fontWeight: '800',
  },

  // Active Server Scraper Metadata Query Bar & VLC Engine Badge
  metadataQueryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0a0f1d',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(56, 189, 248, 0.25)',
    paddingVertical: verticalScale(9),
    paddingHorizontal: scale(14),
  },
  metadataQueryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: scale(8),
  },
  metadataQueryLabel: {
    color: '#94a3b8',
    fontSize: moderateScale(9),
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metadataQueryValue: {
    color: '#38bdf8',
    fontSize: moderateScale(11.5),
    fontWeight: '800',
    marginTop: verticalScale(1),
  },
  metadataEngineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.35)',
    paddingVertical: verticalScale(3),
    paddingHorizontal: scale(7),
    borderRadius: scale(6),
  },
  metadataEngineBadgeText: {
    color: '#4ade80',
    fontSize: moderateScale(9.5),
    fontWeight: '700',
  },
  loaderSubText: {
    color: '#94a3b8',
    fontSize: moderateScale(10),
    fontWeight: '600',
    marginTop: verticalScale(4),
  },
  playbackErrorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070b14',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(20),
    zIndex: 50,
  },
  playbackErrorTitle: {
    color: '#ffffff',
    fontSize: moderateScale(16),
    fontWeight: '700',
    marginBottom: verticalScale(6),
    textAlign: 'center',
  },
  playbackErrorMessage: {
    color: '#94a3b8',
    fontSize: moderateScale(12),
    lineHeight: verticalScale(18),
    textAlign: 'center',
    marginBottom: verticalScale(16),
  },
  playbackErrorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  playbackErrorRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(9),
    borderRadius: scale(8),
  },
  playbackErrorSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(9),
    borderRadius: scale(8),
  },
  playbackErrorBtnText: {
    color: '#ffffff',
    fontSize: moderateScale(13),
    fontWeight: '600',
  },
});
