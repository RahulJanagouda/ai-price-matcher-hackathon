import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Path } from 'react-native-svg';

// Font-independent icons: the icon font can be blocked or fail to decode
// on web (ad blockers, flaky networks), rendering tofu boxes. These inline
// Material Symbols paths render everywhere with zero downloads.
const ICON_PATHS = {
  mic: 'M480-400q-50 0-85-35t-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35Zm0-240Zm-40 520v-123q-104-14-172-93t-68-184h80q0 83 58.5 141.5T480-320q83 0 141.5-58.5T680-520h80q0 105-68 184t-172 93v123h-80Zm40-360q17 0 28.5-11.5T520-520v-240q0-17-11.5-28.5T480-800q-17 0-28.5 11.5T440-760v240q0 17 11.5 28.5T480-480Z',
  'qr-code-scanner':
    'M80-680v-200h200v80H160v120H80Zm0 600v-200h80v120h120v80H80Zm600 0v-80h120v-120h80v200H680Zm120-600v-120H680v-80h200v200h-80ZM700-260h60v60h-60v-60Zm0-120h60v60h-60v-60Zm-60 60h60v60h-60v-60Zm-60 60h60v60h-60v-60Zm-60-60h60v60h-60v-60Zm120-120h60v60h-60v-60Zm-60 60h60v60h-60v-60Zm-60-60h60v60h-60v-60Zm240-320v240H520v-240h240ZM440-440v240H200v-240h240Zm0-320v240H200v-240h240Zm-60 500v-120H260v120h120Zm0-320v-120H260v120h120Zm320 0v-120H580v120h120Z',
  keyboard:
    'M160-200q-33 0-56.5-23.5T80-280v-400q0-33 23.5-56.5T160-760h640q33 0 56.5 23.5T880-680v400q0 33-23.5 56.5T800-200H160Zm0-80h640v-400H160v400Zm160-40h320v-80H320v80ZM200-440h80v-80h-80v80Zm120 0h80v-80h-80v80Zm120 0h80v-80h-80v80Zm120 0h80v-80h-80v80Zm120 0h80v-80h-80v80ZM200-560h80v-80h-80v80Zm120 0h80v-80h-80v80Zm120 0h80v-80h-80v80Zm120 0h80v-80h-80v80Zm120 0h80v-80h-80v80ZM160-280v-400 400Z',
  'shopping-cart':
    'M280-80q-33 0-56.5-23.5T200-160q0-33 23.5-56.5T280-240q33 0 56.5 23.5T360-160q0 33-23.5 56.5T280-80Zm400 0q-33 0-56.5-23.5T600-160q0-33 23.5-56.5T680-240q33 0 56.5 23.5T760-160q0 33-23.5 56.5T680-80ZM246-720l96 200h280l110-200H246Zm-38-80h590q23 0 35 20.5t1 41.5L692-482q-11 20-29.5 31T622-440H324l-44 80h480v80H280q-45 0-68-39.5t-2-78.5l54-98-144-304H40v-80h130l38 80Zm134 280h280-280Z',
  'chevron-right': 'M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z',
  bookmark:
    'M200-120v-640q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v640L480-240 200-120Zm80-122 200-86 200 86v-518H280v518Zm0-518h400-400Z',
  'broken-image':
    'M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm40-337 160-160 160 160 160-160 40 40v-183H200v263l40 40Zm-40 257h560v-264l-40-40-160 160-160-160-160 160-40-40v184Zm0 0v-264 80-376 560Z',
  'stop-circle':
    'M320-320h320v-320H320v320ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
  'photo-camera':
    'M480-260q75 0 127.5-52.5T660-440q0-75-52.5-127.5T480-620q-75 0-127.5 52.5T300-440q0 75 52.5 127.5T480-260Zm0-80q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM160-120q-33 0-56.5-23.5T80-200v-480q0-33 23.5-56.5T160-760h126l74-80h240l74 80h126q33 0 56.5 23.5T880-680v480q0 33-23.5 56.5T800-120H160Zm0-80h640v-480H638l-73-80H395l-73 80H160v480Zm320-240Z',
  close:
    'm256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z',
  edit:
    'M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z',
} as const;

type IconName = keyof typeof ICON_PATHS | 'bookmark-border';

function iconParts(name: keyof typeof ICON_PATHS): { d: string; viewBox: string } {
  const raw = ICON_PATHS[name];
  if (raw.startsWith('VIEWBOX:')) {
    const bar = raw.indexOf('|');
    return { d: raw.slice(bar + 1), viewBox: raw.slice('VIEWBOX:'.length, bar) };
  }
  return { d: raw, viewBox: '0 -960 960 960' };
}

function AppIcon({ name, size = 24, color = C.text }: { name: IconName; size?: number; color?: string }) {
  if (name === 'bookmark-border') {
    return (
      <Svg width={size} height={size} viewBox="0 -960 960 960">
        <Path d={ICON_PATHS.bookmark} fill="none" stroke={color} strokeWidth={80} />
      </Svg>
    );
  }
  const { d, viewBox } = iconParts(name as keyof typeof ICON_PATHS);
  return (
    <Svg width={size} height={size} viewBox={viewBox}>
      <Path d={d} fill={color} />
    </Svg>
  );
}
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden; the app still boots normally.
});

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://ai-price-matcher-api.satya-3bf.workers.dev';

// Semantic color tokens: single source for every surface, text, and state.
const C = {
  primary: '#0a7d33',
  onPrimary: '#ffffff',
  secondary: '#123c8c',
  onSecondary: '#ffffff',
  danger: '#b00020',
  warningBorder: '#e0a800',
  warningBg: '#fff8e1',
  text: '#161616',
  muted: '#595959',
  faint: '#8a8a8a',
  border: '#c9c9c9',
  cardBorder: '#dcdcdc',
  traceBg: '#eef6f0',
  traceText: '#1f3652',
  imageBg: '#f4f4f4',
  orbRing: '#e8f3ec',
  backdrop: 'rgba(0,0,0,0.45)',
  pressedLight: 'rgba(255,255,255,0.25)',
  pressedDark: 'rgba(0,0,0,0.12)',
};

const isWeb = Platform.OS === 'web';
const SESSIONS_KEY = 'moosecart-sessions';

// ---------------------------------------------------------------------------
// Moose orb: the app's personality. One looping clip per state, cropped
// into a circle. Idle blinks by the cart; working types with headphones;
// matching juggles the orb; success poses with the cart.
// ---------------------------------------------------------------------------
const MOOSE_CLIPS = {
  idle: require('./assets/moose/idle.mp4'),
  working: require('./assets/moose/working.mp4'),
  matching: require('./assets/moose/matching.mp4'),
  success: require('./assets/moose/success.mp4'),
} as const;

// Item title strips cycle through these tints so neighbouring items are
// easy to tell apart at a glance.
const STRIP_COLORS = ['#e8f3ec', '#e9eefb', '#fdf3e3', '#f3e9f7', '#e7f5f5', '#fbe9ec'];

// Deterministic avatar background per merchant name (no downloaded logos).
const AVATAR_COLORS = ['#0a7d33', '#123c8c', '#7a4dbf', '#b25b09', '#0e7490', '#a31621'];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? '')).toUpperCase();
}

function merchantSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Real merchant marks, wired by static require() (Metro forbids dynamic
// paths). Drop PNGs in apps/mobile/assets/merchants/ and add one entry
// per slug, e.g. 'food-basics': require('./assets/merchants/food-basics.png').
// Missing entries fall back to the initial chip below — never a broken
// image. Logo provenance: Wikimedia Commons file thumbs for the big
// eight; Google favicon service for food-basics, giant-tiger, metro,
// longos, healthy-planet (all eyeballed before wiring). No obtainable
// mark for shoppers, rexall, fortinos, adonis after three sources —
// their chips stay until official art is supplied.
const MERCHANT_LOGOS: Record<string, number> = {
  'freshco': require('./assets/merchants/freshco.png'),
  'walmart': require('./assets/merchants/walmart.png'),
  'sobeys': require('./assets/merchants/sobeys.png'),
  'real-canadian-superstore': require('./assets/merchants/real-canadian-superstore.png'),
  'loblaws': require('./assets/merchants/loblaws.png'),
  'zehrs': require('./assets/merchants/zehrs.png'),
  'your-independent-grocer': require('./assets/merchants/your-independent-grocer.png'),
  'no-frills': require('./assets/merchants/no-frills.png'),
  'food-basics': require('./assets/merchants/food-basics.png'),
  'giant-tiger': require('./assets/merchants/giant-tiger.png'),
  'metro': require('./assets/merchants/metro.png'),
  'longos': require('./assets/merchants/longos.png'),
  'healthy-planet': require('./assets/merchants/healthy-planet.png'),
};

function merchantLogoId(name: string): number | null {
  const slug = merchantSlug(name);
  if (MERCHANT_LOGOS[slug]) return MERCHANT_LOGOS[slug];
  const hit = Object.keys(MERCHANT_LOGOS).find(
    (key) => slug.startsWith(key) || slug.includes(`-${key}`),
  );
  return hit ? MERCHANT_LOGOS[hit] : null;
}

function MerchantAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const logo = merchantLogoId(name);
  if (logo) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#ffffff',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
        accessible={false}
      >
        <Image
          source={logo}
          style={{ width: size * 0.8, height: size * 0.8 }}
          resizeMode="contain"
          accessibilityLabel={`${name} logo`}
        />
      </View>
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(name),
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessible={false}
    >
      <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', color: '#fff', fontSize: size * 0.38 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

// Claude-code-style spinner frames for the phase line while working.
// U+FE0E forces TEXT presentation: without it some frames (e.g. ✻✳)
// render as color emoji on iOS.
const SPINNER_FRAMES = ['\u00B7', '\u273B\uFE0E', '\u273D\uFE0E', '\u2736\uFE0E', '\u2733\uFE0E', '\u2722\uFE0E'];

function PhaseSpinner({ active }: { active: boolean }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 140);
    return () => clearInterval(t);
  }, [active]);
  return <Text style={styles.spinner}>{SPINNER_FRAMES[active ? frame : 0]} </Text>;
}

// Pulsing dots that replace the idle bottom-bar buttons while working.
// Pure transform/opacity so the guides stay smooth; static when reduced motion.
function PulseDots({ active, still }: { active: boolean; still: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || still) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: !isWeb }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: !isWeb }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, still, pulse]);
  const dots = [0, 1];
  return (
    <View style={styles.dotsRow} accessible={false}>
      {dots.map((d) => (
        <Animated.View
          key={d}
          style={[
            styles.dot,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

type MooseState = keyof typeof MOOSE_CLIPS;

function useLoopPlayer(source: number) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.playbackRate = 0.8;
  });
  // play() before the clip is loaded is a silent no-op, so retry every
  // time the player reports it is ready.
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  useEffect(() => {
    if (status !== 'readyToPlay') return;
    try {
      player.play();
    } catch {
      // Not playable yet; the next status change retries.
    }
  }, [status, player]);
  return player;
}

function MooseOrb({
  state,
  size = 120,
  still = false,
  once = false,
  onEnded,
}: {
  state: MooseState;
  size?: number | Animated.Value;
  still?: boolean;
  // once: play the clip a single time (loop off) and call onEnded when it
  // finishes. Used for the success celebration; everything else loops.
  once?: boolean;
  onEnded?: () => void;
}) {
  // Animated size lets the one persistent orb grow/shrink smoothly between
  // screens and working states. The outer Animated.View carries the
  // animated geometry and clips the full-bleed inner view into a square
  // (plain View/Image/VideoView styles cannot hold animated values
  // directly). Square, on a white box that blends into the video's own
  // white background — no circular crop.
  if (still) {
    return (
      <Animated.View style={[styles.orb, { width: size, height: size }]}>
        <Image
          source={require('./assets/moose/logo.jpg')}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          accessibilityLabel="MooseCart moose"
        />
      </Animated.View>
    );
  }
  const players = {
    idle: useLoopPlayer(MOOSE_CLIPS.idle),
    working: useLoopPlayer(MOOSE_CLIPS.working),
    matching: useLoopPlayer(MOOSE_CLIPS.matching),
    success: useLoopPlayer(MOOSE_CLIPS.success),
  };
  useEffect(() => {
    for (const [name, player] of Object.entries(players)) {
      try {
        if (name === state) player.play();
        else player.pause();
      } catch {
        // Player not ready; the status effect above retries play.
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  // The OS pauses video decoders in the background, but nothing replayed
  // them on return: status stays readyToPlay and state is unchanged, so
  // both play triggers above stayed silent and the orb froze on a frame.
  // Resume the visible clip on every foreground return. Props already
  // reflect reality at that point (a timer that fired while hidden has
  // flipped once/state back to the idle loop), so an unconditional play
  // of the current clip is correct in all cases.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      try {
        players[state].play();
      } catch {
        // Player not ready; the status effect above retries play.
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  // Single-play mode: never trust status events to observe the end of
  // playback (they never fired for this clip, so the celebration looped
  // — the backup listener is gone). Looping is switched off and the end
  // is timed from the clip's own duration, read synchronously — the
  // player preloads at mount, so it is populated long before the
  // celebration ever triggers. Playing is owned by the state switcher
  // above; this effect only owns the loop flag and the timer, so the orb
  // plays the sting exactly once.
  const onceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishOnce = useRef(onEnded);
  finishOnce.current = onEnded;
  useEffect(() => {
    const player = players[state];
    if (onceTimer.current) {
      clearTimeout(onceTimer.current);
      onceTimer.current = null;
    }
    try {
      player.loop = !once;
    } catch {
      // Player not ready; the timed end below still applies.
    }
    if (!once) return;
    const ms =
      (player.duration && player.duration > 0 ? player.duration : 8) * 1000 + 300;
    onceTimer.current = setTimeout(() => {
      onceTimer.current = null;
      try {
        player.pause();
      } catch {
        // Already paused; safe to ignore.
      }
      finishOnce.current?.();
    }, ms);
    return () => {
      if (onceTimer.current) {
        clearTimeout(onceTimer.current);
        onceTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, once]);
  return (
    <Animated.View
      style={[styles.orb, { width: size, height: size, backgroundColor: '#fff' }]}
      accessible={false}
    >
      <VideoView
        player={players[state]}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls={false}
        // iOS Safari otherwise hijacks the orb into fullscreen playback.
        playsInline
        allowsPictureInPicture={false}
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Offer = {
  dealId: number;
  name: string;
  merchant: string;
  currentPrice: number;
  currency: string;
  priceBasis: { unit: string; raw: string | null };
  priceMatchable?: boolean;
  priceMatchAtFreshCo?: boolean;
  validTo: string;
  imageUrl: string;
  pageImageUrl?: string | null;
  reviewReason?: string;
};

type SearchResult = {
  confirmed: Offer[];
  review: Offer[];
  excludedCount: number;
  beatCents?: number;
  chain?: string;
};

type ItemResult = {
  name: string;
  quantity: number | null;
  search: SearchResult;
};

type SavedPick = { item: string; offer: Offer; beatCents?: number };

type Session = {
  id: string;
  savedAt: string;
  storeId: string;
  storeName: string;
  picks: SavedPick[];
};

// Search history: one lightweight record per completed search (inputs +
// match counts only — no offer payloads; results reference the snapshot
// by dealId). Powers "Recent searches" re-runs from the cart sheet.
type SearchRecord = {
  id: string;
  savedAt: string;
  storeId: string;
  storeName: string;
  kind: 'list' | 'photo' | 'barcode';
  inputs: { name: string; quantity: number | null }[];
  matched: number;
  total: number;
};

const SEARCHES_KEY = 'moosecart-searches';
const MAX_SEARCHES = 20;

type Store = {
  id: string;
  chain: string;
  name: string;
  address: string;
  distanceKm: number;
  note: string;
  enabled: boolean;
};

type Phase =
  | 'awaiting'
  | 'listening'
  | 'reading'
  | 'parsing'
  | 'matching'
  | 'done'
  | 'error';

const PHASE_LABEL: Record<Phase, string> = {
  awaiting: 'Let me know which groceries you want to buy cheaper?',
  listening: 'Listening…',
  reading: 'Reading your list…',
  parsing: 'Parsing items…',
  matching: 'Matching offers…',
  done: 'Found offers for you to price match',
  error: 'Something hiccuped',
};

function mooseForPhase(phase: Phase): MooseState {
  switch (phase) {
    case 'reading':
    case 'parsing':
      return 'working';
    case 'matching':
      return 'matching';
    // 'done' intentionally idles: the success sting plays only while
    // successFlash is set (single play, then back here). Mapping done to
    // the success clip looped the celebration forever.
    case 'done':
    default:
      return 'idle';
  }
}

const FALLBACK_STORES: Store[] = [
  {
    id: 'freshco-milton',
    chain: 'FreshCo',
    name: 'FreshCo Milton',
    address: '9060 Louis St Laurent Ave, Milton, ON',
    distanceKm: 1.2,
    note: 'Lowest Price Guarantee: beats Ontario discount competitors by 1¢.',
    enabled: true,
  },
];

async function loadSessions(): Promise<Session[]> {
  try {
    if (isWeb) {
      const raw = globalThis.localStorage?.getItem(SESSIONS_KEY);
      return raw ? (JSON.parse(raw) as Session[]) : [];
    }
    const f = new File(Paths.document, 'moosecart-sessions.json');
    if (!f.exists) return [];
    return JSON.parse(await f.text()) as Session[];
  } catch {
    return [];
  }
}

async function storeSessions(sessions: Session[]): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    return;
  }
  const f = new File(Paths.document, 'moosecart-sessions.json');
  if (!f.exists) f.create();
  f.write(JSON.stringify(sessions));
}

async function loadSearches(): Promise<SearchRecord[]> {
  try {
    if (isWeb) {
      const raw = globalThis.localStorage?.getItem(SEARCHES_KEY);
      return raw ? (JSON.parse(raw) as SearchRecord[]) : [];
    }
    const f = new File(Paths.document, 'moosecart-searches.json');
    if (!f.exists) return [];
    return JSON.parse(await f.text()) as SearchRecord[];
  } catch {
    return [];
  }
}

async function storeSearches(searches: SearchRecord[]): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(SEARCHES_KEY, JSON.stringify(searches));
    return;
  }
  const f = new File(Paths.document, 'moosecart-searches.json');
  if (!f.exists) f.create();
  f.write(JSON.stringify(searches));
}

export default function App() {
  const [screen, setScreen] = useState<'login' | 'stores' | 'main'>('login');
  const [stores, setStores] = useState<Store[]>(FALLBACK_STORES);
  const [store, setStore] = useState<Store | null>(null);
  const [phase, setPhase] = useState<Phase>('awaiting');
  const [lastRunOk, setLastRunOk] = useState(false);
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [items, setItems] = useState<ItemResult[]>([]);
  const [picks, setPicks] = useState<Record<string, Offer>>({});
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searches, setSearches] = useState<SearchRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function stopWork() {
    abortRef.current?.abort();
    setSuccessFlash(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function isCancel(e: unknown): boolean {
    // Native fetch abort errors don't always carry the DOM AbortError name
    // ("Fetch request has been canceled"), so match the message too.
    if (e instanceof DOMException ? e.name === 'AbortError' : (e as Error)?.name === 'AbortError') return true;
    const msg = e instanceof Error ? e.message : String(e ?? '');
    return /abort|cancel/i.test(msg);
  }
  const [evidence, setEvidence] = useState<{
    item: string;
    offer: Offer;
    isReview: boolean;
    // Cents under the competitor price this store promises (FreshCo: 1,
    // No Frills/RCSS: 0). Absent for old saves — the modal stays neutral.
    beatCents?: number;
  } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartTab, setCartTab] = useState<'saved' | 'searches'>('saved');
  // Non-matchable deals hidden behind a per-item link, shown in a sheet.
  const [sheet, setSheet] = useState<{ item: string; offers: Offer[] } | null>(null);
  // Moose pick per item: model-chosen best deal from the vetted shortlist.
  const [moosePicks, setMoosePicks] = useState<Record<string, { dealId: number; reason: string; fallback: boolean }>>({});
  // Accumulated barcode scans (max 10), priced together on finish.
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  // Mimicked location fix on the store picker.
  const [locating, setLocating] = useState(false);
  // Success celebration plays once, then the orb settles back to idle.
  const [successFlash, setSuccessFlash] = useState(false);
  // What the current work is: drives task-true phase text ("Looking at
  // your photos" vs "Reading your list", never the wrong verb).
  const [workKind, setWorkKind] = useState<'list' | 'photo' | 'barcode' | null>(null);
  const [photoTotal, setPhotoTotal] = useState(1);
  // Lightweight toast (web barcode hint and friends).
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  function openCart() {
    setCartTab('saved');
    setCartOpen(true);
  }

  function closeCart() {
    setCartOpen(false);
  }

  useEffect(() => {
    if (!cartOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setCartOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [cartOpen]);
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeDraft, setTypeDraft] = useState('');
  const [typeFocused, setTypeFocused] = useState(false);
  const [photoChoiceOpen, setPhotoChoiceOpen] = useState(false);
  const [seenOpen, setSeenOpen] = useState(false);
  const [seen, setSeen] = useState<{ seen: string; items: { name: string; quantity: number | null; unit: string | null }[] } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollRef = useRef<any>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const holdRef = useRef<{ started: boolean; t: number; pressed: boolean }>({
    started: false,
    t: 0,
    pressed: false,
  });
  // Hold-to-talk arming: taps must never touch the recorder. Recording
  // starts only after 600ms of continuous press; a release before that
  // just teaches the gesture. This also kills the double-tap race where
  // interleaved async start/stop calls stranded recording=true.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warmPromise = useRef<Promise<boolean> | null>(null);

  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular: require('./assets/fonts/SpaceGrotesk-400.ttf'),
    SpaceGrotesk_500Medium: require('./assets/fonts/SpaceGrotesk-500.ttf'),
    SpaceGrotesk_700Bold: require('./assets/fonts/SpaceGrotesk-700.ttf'),
  });
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontsTimedOut(true), 3500);
    return () => clearTimeout(t);
  }, []);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {
        // Assume full motion when the setting is unreadable.
      });
  }, []);

  // The one persistent orb: big on login, full-screen while working,
  // compact header size everywhere else. A single mounted instance keeps
  // video playing across screens; size animates smoothly between states.
  // The sizing effect lives below the font gate because no hook may sit
  // under an early return.
  const ORB_BIG = 280;
  const ORB_SMALL = 112;
  const ORB_WORKING = 320;
  const orbSize = useRef(new Animated.Value(ORB_BIG)).current;
  const workingNow = busy || recording;
  // Recording keeps the normal chrome (small orb, prompt body, pinned bar):
  // only real network/model work takes the fullscreen working layout.
  // First landing shows the orb at working size so the header doesn't
  // look empty — size only, layout untouched.
  const firstLanding =
    screen === 'main' && !!store && items.length === 0 && !cartOpen && !error && !scanning;
  const orbBig = screen === 'login' || busy || firstLanding;

  // Gentle crossfade of the body below the orb on screen changes, so the
  // orb reads as travelling while the content settles in beneath it.
  const bodyFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) return;
    bodyFade.setValue(0);
    Animated.timing(bodyFade, {
      toValue: 1,
      duration: 600,
      useNativeDriver: !isWeb,
    }).start();
  }, [screen, bodyFade, reduceMotion]);

  // Mimicked location fix each time the picker opens: brief "locating"
  // beat, then the Milton stores. Labelled as a demo location on screen.
  useEffect(() => {
    if (screen !== 'stores') return;
    setLocating(true);
    const t = setTimeout(() => setLocating(false), 1200);
    return () => clearTimeout(t);
  }, [screen]);

  // Success celebration safety net: if the timed end never fires, the
  // orb still settles back to idle. Sized past the real 8s sting.
  useEffect(() => {
    if (!successFlash) return;
    const t = setTimeout(() => setSuccessFlash(false), 12000);
    return () => clearTimeout(t);
  }, [successFlash]);
  useEffect(() => {
    if (fontsLoaded || fontsTimedOut) {
      SplashScreen.hideAsync().catch(() => {
        // Already hidden; safe to ignore.
      });
    }
  }, [fontsLoaded, fontsTimedOut]);

  useEffect(() => {
    (async () => {
      setSessions(await loadSessions());
      setSearches(await loadSearches());
      try {
        const res = await fetch(`${API_URL}/stores`);
        if (res.ok) {
          const data = (await res.json()) as { stores: Store[] };
          // Only price-matchable stores are listed; coming-soon entries stay out.
          const enabled = (data.stores ?? []).filter((s) => s.enabled);
          if (enabled.length) setStores(enabled);
        }
      } catch {
        // Offline or older backend: fall back to the bundled store list.
      }
    })();
  }, []);

  useEffect(() => {
    if (!recording) return;
    setRecSeconds(0);
    const t = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const chainName = store?.chain ?? 'FreshCo';
  const savedCount = sessions.reduce((n, s) => n + s.picks.length, 0);

  function beatFor(offer: Offer, beatCents: number): number {
    const matchable = offer.priceMatchable ?? offer.priceMatchAtFreshCo ?? false;
    return matchable ? Math.max(0, offer.currentPrice - beatCents / 100) : offer.currentPrice;
  }

  async function priceItems(
    parsedItems: { name: string; quantity: number | null }[],
    firstLine: string,
    activeStore: Store,
    signal?: AbortSignal,
    kind: 'list' | 'photo' | 'barcode' = 'list',
  ) {
    setPhase('matching');
    const lines: string[] = [
      firstLine,
      `Parsed ${parsedItems.length} item${parsedItems.length === 1 ? '' : 's'}: ${parsedItems.map((i) => i.name).join(', ')}`,
    ];
    setStatusLines([...lines]);
    const results: ItemResult[] = [];
    let beatCents = 1;
    for (const item of parsedItems) {
      // Stepwise trace: one line lands per item as its search resolves, so
      // the status builds progressively instead of all at once.
      setStatusLines([...lines, `Matching "${item.name}"…`]);
      const res = await fetch(
        `${API_URL}/search?q=${encodeURIComponent(item.name)}&store=${encodeURIComponent(activeStore.id)}`,
        ...(signal ? [{ signal }] : []),
      );
      if (!res.ok) throw new Error(`search ${res.status}`);
      const search = (await res.json()) as SearchResult;
      if (typeof search.beatCents === 'number') beatCents = search.beatCents;
      results.push({ name: item.name, quantity: item.quantity, search });
      const found = search.confirmed.length;
      lines.push(`"${item.name}": ${found} confirmed offer${found === 1 ? '' : 's'}`);
      setStatusLines([...lines]);
    }
    setItems(results);
    const matched = results.filter((r) => r.search.confirmed.length > 0).length;
    const needsCall = results.reduce((n, r) => n + r.search.review.length, 0);
    const anyEligible = results.some((r) =>
      r.search.confirmed.some((o) => o.priceMatchable ?? o.priceMatchAtFreshCo),
    );
    // No basket, no totals, no savings math: the app finds the best
    // price-matchable offer per item and the shopper saves offers for the
    // cashier. Per-offer prices stand on their own.
    lines.push(
      `Matched ${matched}/${results.length} items · ${needsCall} candidate${needsCall === 1 ? '' : 's'} need your call`,
      matched
        ? anyEligible
          ? `Best price-matchable offers found at ${activeStore.name} — save them for the cashier`
          : `Flyer prices found, but none are price-matchable at ${activeStore.name} — save what helps, skip the rest`
        : 'No confirmed matches yet — nothing priced by guesswork.',
    );
    setStatusLines([...lines]);
    setLastRunOk(matched > 0);
    setPhase(matched > 0 ? 'done' : 'awaiting');
    // Search history: record the completed run (inputs + counts only).
    // Aborted runs throw before reaching here, so they stay unrecorded.
    // Storage failure stays silent — history must never break results.
    try {
      const entry: SearchRecord = {
        id: `${Date.now()}`,
        savedAt: new Date().toISOString(),
        storeId: activeStore.id,
        storeName: activeStore.name,
        kind,
        inputs: parsedItems,
        matched,
        total: results.length,
      };
      const updated = [entry, ...searches].slice(0, MAX_SEARCHES);
      setSearches(updated);
      await storeSearches(updated);
    } catch {
      // History is garnish; the offers above stand on their own.
    }
    if (matched > 0) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Celebration plays once, then the orb settles back to idle.
      setSuccessFlash(true);
      // Ask the model to crown one best deal per item with real choices.
      // Eligibility and prices stay flyer-grounded; failures stay silent
      // (no pick badge) rather than blocking the results.
      void (async () => {
        const picks: Record<string, { dealId: number; reason: string; fallback: boolean }> = {};
        await Promise.all(
          results.map(async (r) => {
            const eligible = r.search.confirmed.filter(
              (o) => o.priceMatchable ?? o.priceMatchAtFreshCo,
            );
            if (!eligible.length) return;
            if (eligible.length === 1) {
              picks[r.name] = {
                dealId: eligible[0].dealId,
                reason: 'Only price-matchable offer for this item.',
                fallback: true,
              };
              return;
            }
            try {
              const res = await fetch(`${API_URL}/bestdeal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  item: r.name,
                  offers: eligible.slice(0, 3).map((o) => ({
                    dealId: o.dealId,
                    name: o.name,
                    merchant: o.merchant,
                    payable: beatFor(o, r.search.beatCents ?? beatCents),
                    currency: o.currency,
                    basis: o.priceBasis.raw,
                    validTo: o.validTo,
                  })),
                }),
                ...(signal ? { signal } : {}),
              });
              if (!res.ok) return;
              const pick = (await res.json()) as { dealId: number; reason: string; fallback: boolean };
              if (typeof pick.dealId === 'number') picks[r.name] = pick;
            } catch {
              // Ranking is garnish; the offers below stand on their own.
            }
          }),
        );
        if (Object.keys(picks).length) setMoosePicks((prev) => ({ ...prev, ...picks }));
      })();
    }
  }

  async function priceList(
    text: string,
    activeStore: Store,
    firstTraceLine?: string,
    kind: 'list' | 'photo' | 'barcode' = 'list',
  ) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setSuccessFlash(false);
    setScanning(false);
    setScannedCodes([]);
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setItems([]);
    setPhase('parsing');
    const lines: string[] = [firstTraceLine ?? `List: "${trimmed}"`, 'Parsing items…'];
    setStatusLines([...lines]);
    try {
      const parseRes = await fetch(`${API_URL}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
        signal: controller.signal,
      });
      if (!parseRes.ok) throw new Error(`parse ${parseRes.status}`);
      const parsed = (await parseRes.json()) as {
        items: { name: string; quantity: number | null }[];
      };
      await priceItems(parsed.items, lines[0], activeStore, controller.signal, kind);
    } catch (e) {
      if (isCancel(e)) {
        setStatusLines([...lines, 'Stopped.']);
        setPhase('awaiting');
      } else {
        // Errors reset to the idle view: no stale results linger.
        setItems([]);
        setError(e instanceof Error ? e.message : 'failed');
        setPhase('error');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setStatusLines([...lines, 'Failed — check the backend is running']);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  // Scans accumulate (up to 10): the camera keeps running and each new
  // barcode joins the batch. Turning the scanner off prices the batch.
  function onBarcode(barcode: string) {
    setScannedCodes((prev) => {
      if (prev.includes(barcode) || prev.length >= 10) return prev;
      const next = [...prev, barcode];
      setStatusLines([
        `Scanned ${next.length}/10 barcode${next.length === 1 ? '' : 's'} — keep scanning or tap the QR button to price them`,
      ]);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return next;
    });
  }

  async function lookupBarcodes(codes: string[], activeStore: Store) {
    setScanning(false);
    setScannedCodes([]);
    if (!codes.length || busy) return;
    setWorkKind('barcode');
    // priceList owns the busy flag; this controller only covers the
    // OpenFoodFacts lookups so Stop still cancels this phase.
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setItems([]);
    setPhase('reading');
    const lines = [`Scanned ${codes.length} barcode${codes.length === 1 ? '' : 's'}`, 'Looking up product identities…'];
    setStatusLines([...lines]);
    try {
      const names: string[] = [];
      for (const code of codes) {
        setStatusLines([...lines, `Looking up ${code} (${names.length} identified)…`]);
        const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as {
          status?: number;
          product?: { product_name?: string; brands?: string; quantity?: string };
        };
        const name = data.product?.product_name?.trim();
        if (res.ok && data.status === 1 && name && !names.includes(name)) names.push(name);
      }
      if (!names.length) {
        // Same reset as errors: no stale results linger behind the message.
        setItems([]);
        setStatusLines([...lines, 'No products identified — type the items instead']);
        setPhase('awaiting');
        return;
      }
      setPhase('parsing');
      await priceList(names.join(', '), activeStore, `Scanned: ${names.join(', ')}`, 'barcode');
    } catch (e) {
      if (isCancel(e)) {
        setStatusLines([...lines, 'Stopped.']);
        setPhase('awaiting');
      } else {
        // Errors reset to the idle view: no stale results linger.
        setItems([]);
        setStatusLines([...lines, 'Lookup failed — type the items instead']);
        setPhase('awaiting');
      }
    } finally {
      // priceList manages busy itself when it runs.
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  // Warms the recorder without capturing: stop any leftover, permission,
  // audio mode, prepare. Starts on press-in so the 600ms hold and the async
  // setup overlap — recording then begins the instant the hold qualifies
  // instead of after hold + setup in series.
  const warmGen = useRef(0);
  async function warmRecorder(): Promise<boolean> {
    const myWarm = ++warmGen.current;
    try {
      try {
        await recorder.stop();
      } catch {
        // Nothing was recording; safe to ignore.
      }
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError('Microphone permission denied — type the list instead');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return false;
      }
      await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      return true;
    } catch (e) {
      // A superseded warm (double-tap overlap) stays silent.
      if (myWarm === warmGen.current) {
        setError(e instanceof Error ? e.message : 'could not start recording');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return false;
    }
  }

  // Begins capturing. The recorder must already be warm (press-in warms it
  // while the 600ms hold elapses). Returns true when actually recording —
  // press-and-hold dictation depends on this: press-out must tell a denial
  // from a live hold.
  async function beginRecording(): Promise<boolean> {
    holdRef.current.started = false;
    try {
      recorder.record();
      // Released during the async startup: stop immediately and report
      // nothing — press-out already moved on.
      if (!holdRef.current.pressed) {
        try {
          await recorder.stop();
        } catch {
          // Never really started; safe to ignore.
        }
        return false;
      }
      holdRef.current.started = true;
      setScanning(false);
      setRecording(true);
      setError(null);
      setPhase('listening');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not start recording');
      return false;
    }
  }

  async function stopAndTranscribe(activeStore: Store) {
    try {
      await recorder.stop();
      setRecording(false);
      const uri = recorder.uri ?? recorder.getStatus().url;
      if (!uri) throw new Error('no recording captured');
      setBusy(true);
      setPhase('reading');
      setStatusLines(['Sending your voice list to Muse Spark Open…']);
      // Web recordings are blob URLs (MediaRecorder/webm); native ones are m4a files.
      const bytes = isWeb
        ? new Uint8Array(await (await fetch(uri)).arrayBuffer())
        : await new File(uri).bytes();
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch(`${API_URL}/dictate`, {
        method: 'POST',
        headers: { 'Content-Type': isWeb ? 'audio/webm' : 'audio/m4a' },
        body: bytes as unknown as BodyInit,
        signal: controller.signal,
      });
      if (!res.ok)
        throw new Error(
          'Could not understand that recording — speak closer to the mic and try again, or type the list'
        );
      const data = (await res.json()) as {
        transcript: string;
        items: { name: string; quantity: number | null }[];
      };
      await priceItems(data.items, `Heard: "${data.transcript}"`, activeStore, controller.signal);
    } catch (e) {
      if (isCancel(e)) {
        setStatusLines(['Stopped.']);
        setPhase('awaiting');
      } else {
        // Errors reset to the idle view: no stale results linger.
        setItems([]);
        setError(e instanceof Error ? e.message : 'dictation failed');
        setPhase('error');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  // Up to 10 photos per turn: library multi-select in one go, camera one
  // shot at a time. Each photo is resized to 1280px JPEG before upload so
  // full-res shots cannot stall the request; the Stop button cancels.
  async function takePhoto(fromLibrary: boolean, activeStore: Store) {
    setPhotoChoiceOpen(false);
    if (busy) return;
    setWorkKind('photo');
    setScanning(false);
    setScannedCodes([]);
    const perm = fromLibrary
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Photo permission denied — type the list instead');
      return;
    }
    const result = fromLibrary
      ? await ImagePicker.launchImageLibraryAsync({
          allowsEditing: false,
          quality: 0.7,
          allowsMultipleSelection: true,
          selectionLimit: 10,
        })
      : await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.7 });
    if (result.canceled || !result.assets?.length) return;
    const assets = result.assets.slice(0, 10);
    setPhotoTotal(assets.length);
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setPhase('reading');
    const merged: { name: string; quantity: number | null; unit: string | null }[] = [];
    const seenBits: string[] = [];
    try {
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        setStatusLines([
          `Looking at photo ${i + 1} of ${assets.length} with Muse Spark Open…`,
        ]);
        // Shrink before upload: full-res photos time out on slow uplinks.
        // The shrunk copy is always JPEG; the original keeps its own type.
        let uri = asset.uri;
        let mime = asset.mimeType ?? (asset.uri.endsWith('.png') ? 'image/png' : 'image/jpeg');
        try {
          const shrunk = await manipulateAsync(asset.uri, [{ resize: { width: 1280 } }], {
            compress: 0.7,
            format: SaveFormat.JPEG,
          });
          uri = shrunk.uri;
          mime = 'image/jpeg';
        } catch {
          // Fall back to the original bytes when shrinking is unavailable.
        }
        const bytes = isWeb
          ? new Uint8Array(await (await fetch(uri)).arrayBuffer())
          : await new File(uri).bytes();
        const res = await fetch(`${API_URL}/see`, {
          method: 'POST',
          headers: { 'Content-Type': mime },
          body: bytes as unknown as BodyInit,
          signal: controller.signal,
        });
        if (!res.ok)
          throw new Error(
            'Could not make out groceries in that photo — try closer, with the items in frame, or type the list',
          );
        const data = (await res.json()) as {
          seen: string;
          items: { name: string; quantity: number | null; unit: string | null }[];
        };
        if (data.seen) seenBits.push(data.seen);
        for (const item of data.items ?? []) {
          if (!merged.some((m) => m.name.toLowerCase() === item.name.toLowerCase())) {
            merged.push(item);
          }
        }
      }
      setSeen({ seen: seenBits.join(' + ') || 'groceries', items: merged });
      setSeenOpen(true);
      setPhase('awaiting');
      setStatusLines([
        `Moose sees: "${seenBits.join(' + ') || 'groceries'}" — confirm to price them`,
      ]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      if (isCancel(e)) {
        setStatusLines(['Stopped.']);
        setPhase('awaiting');
      } else {
        // Errors reset to the idle view: no stale results linger.
        setItems([]);
        setError(e instanceof Error ? e.message : 'photo failed');
        setPhase('error');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  // Per-offer Save: drops the offer into today's session for this store
  // (creating the session on first save).
  async function saveOffer(item: string, offer: Offer, beatCents?: number) {
    if (!store) return;
    const today = new Date().toISOString().slice(0, 10);
    let updated = [...sessions];
    let session = updated.find((s) => s.storeId === store.id && s.savedAt.slice(0, 10) === today);
    if (!session) {
      session = {
        id: `${Date.now()}`,
        savedAt: new Date().toISOString(),
        storeId: store.id,
        storeName: store.name,
        picks: [],
      };
      updated = [session, ...updated];
    }
    session = {
      ...session,
      picks: [
        ...session.picks.filter((p) => p.item !== item || p.offer.dealId !== offer.dealId),
        { item, offer, beatCents },
      ],
    };
    updated = updated.map((s) => (s.id === session!.id ? session! : s));
    setSessions(updated);
    setPicks((prev) => ({ ...prev, [item]: offer }));
    try {
      await storeSessions(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not save');
    }
  }

  // Remove one saved pick. An emptied session drops off the list instead
  // of lingering as a 0-item row; the Save state on the offer follows.
  async function removePick(sessionId: string, item: string, dealId: number) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = sessions
      .map((s) =>
        s.id === sessionId
          ? { ...s, picks: s.picks.filter((p) => !(p.item === item && p.offer.dealId === dealId)) }
          : s,
      )
      .filter((s) => s.picks.length > 0);
    setSessions(updated);
    setPicks((prev) =>
      prev[item]?.dealId === dealId
        ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== item))
        : prev,
    );
    try {
      await storeSessions(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not remove');
    }
  }

  function EvidenceImage({ uri }: { uri: string }) {
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    if (failed) {
      return (
        <View style={[styles.evidenceImg, styles.evidenceFallback]}>
          <AppIcon name="broken-image" size={40} color={C.muted} />
          <Text style={styles.meta}>Flyer image unavailable — details below are from the offer record</Text>
        </View>
      );
    }
    return (
      <View>
        {loading && (
          <View style={[styles.evidenceImg, styles.evidenceFallback]}>
            <ActivityIndicator />
          </View>
        )}
        <Image
          source={{ uri }}
          style={styles.evidenceImg}
          resizeMode="contain"
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
        />
      </View>
    );
  }

  function OfferCard({
    item,
    offer,
    isReview,
    beatCents,
  }: {
    item: string;
    offer: Offer;
    isReview: boolean;
    beatCents: number;
  }) {
    const matchable = offer.priceMatchable ?? offer.priceMatchAtFreshCo ?? false;
    const saved = sessions.some((s) => s.picks.some((p) => p.offer.dealId === offer.dealId));
    const picked = picks[item]?.dealId === offer.dealId;
    const moosePick = moosePicks[item]?.dealId === offer.dealId ? moosePicks[item] : null;
    return (
      <View style={[styles.card, isReview && styles.reviewCard, picked && styles.pickedCard]}>
        <Pressable
          style={styles.cardMain}
          android_ripple={{ color: C.pressedDark }}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setEvidence({ item, offer, isReview, beatCents });
          }}
          accessibilityRole="button"
          accessibilityLabel={`${offer.name}, ${offer.merchant}, $${offer.currentPrice} ${offer.currency}. Show flyer evidence.`}
        >
          <MerchantAvatar name={offer.merchant} size={36} />
          <View style={styles.cardText}>
            <Text style={styles.name}>{offer.name}</Text>
            <Text style={styles.meta}>
              {offer.merchant} · ${offer.currentPrice} {offer.currency}
              {offer.priceBasis.raw ? ` (${offer.priceBasis.raw})` : ''}
            </Text>
            <Text style={styles.meta}>
              {isReview
                ? `? needs your call — ${offer.reviewReason} · tap to review`
                : `✓ confirmed match · valid to ${new Date(offer.validTo).toLocaleDateString()} · tap for flyer evidence`}
            </Text>
            <Text style={styles.meta}>
              {matchable ? (
                <>
                  <Text style={styles.tick}>✓✓ </Text>
                  {`price-matchable at ${chainName} — you pay $${beatFor(offer, beatCents).toFixed(2)}`}
                </>
              ) : (
                `✗ not price-matchable at ${chainName} (outside its program)`
              )}
            </Text>
            {moosePick && (
              <Text style={styles.pickBadge} accessibilityLabel={`Moose pick: ${moosePick.reason}`}>
                ★ Moose pick — {moosePick.reason}
              </Text>
            )}
          </View>
          <Image source={{ uri: offer.imageUrl }} style={styles.thumb} resizeMode="cover" />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.saveBtn, saved && styles.savedBtn, pressed && styles.cardPressed]}
          android_ripple={{ color: C.pressedDark }}
          onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void saveOffer(item, offer, beatCents);
            }}
          accessibilityRole="button"
          accessibilityLabel={saved ? `Saved ${offer.name}` : `Save ${offer.name} to this session`}
        >
          <AppIcon
            name={saved ? 'bookmark' : 'bookmark-border'}
            size={20}
            color={saved ? C.primary : C.muted}
          />
          <Text style={[styles.saveText, saved && styles.savedText]}>
            {saved ? 'Saved' : 'Save'}
          </Text>
        </Pressable>
      </View>
    );
  }


  const moose = phase === 'done' && !lastRunOk ? 'idle' : mooseForPhase(phase);
  const activeStore = screen === 'main' ? store : null;
  // Success celebration plays once, then the orb settles back to idle.
  const orbState: MooseState =
    screen === 'login'
      ? 'idle'
      : successFlash
        ? 'success'
        : screen === 'stores' || !store
          ? 'matching'
          : moose;
  const headerTitle = screen === 'stores' || !store ? 'Stores near you' : (store?.name ?? '');
  useEffect(() => {
    const target =
      screen === 'login' ? ORB_BIG : orbBig ? ORB_WORKING : ORB_SMALL;
    if (reduceMotion) {
      orbSize.setValue(target);
      return;
    }
    Animated.timing(orbSize, {
      toValue: target,
      duration: 800,
      useNativeDriver: false, // width/height cannot use the native driver
    }).start();
  }, [screen, orbBig, reduceMotion, orbSize]);

  // Font gate AFTER all hooks: if custom fonts are blocked or fail to
  // decode (ad blockers, flaky networks), fall back to system fonts rather
  // than a blank screen. Must stay below every hook (early returns change
  // the hook count and crash React with minified error #310).
  if (!fontsLoaded && !fontsTimedOut) return null;

  // Task-true phase line: the verb always matches the work in progress.
  function phaseLine(): string {
    if (recording) return `Listening… ${recSeconds}s — release to send`;
    switch (phase) {
      case 'listening':
        return 'Listening… speak your list';
      case 'reading':
        if (workKind === 'photo')
          return `Looking at your photo${photoTotal === 1 ? '' : 's'}…`;
        if (workKind === 'barcode') return 'Reading the barcode…';
        return 'Writing down what you said…';
      case 'parsing':
        return workKind === 'photo' ? 'Listing what the moose sees…' : 'Parsing items…';
      default:
        return PHASE_LABEL[phase];
    }
  }

  // ---- Unified shell: one persistent orb mounted once. Screens swap the
  // body beneath it; the orb resizes (login/working = big) and its clip
  // follows the phase. Video never remounts, so playback is continuous.
  return (
    <View style={[styles.shell, isWeb && styles.webPage]}>
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safe, isWeb && styles.safeWeb]} edges={['top', 'bottom']}>
        <View style={[styles.shell, screen === 'login' && styles.shellCenter]}>
          <View style={screen === 'login' ? styles.heroHeader : styles.topBar}>
            <MooseOrb
              state={orbState}
              size={orbSize}
              still={reduceMotion}
              once={successFlash}
              onEnded={() => setSuccessFlash(false)}
            />
            {screen === 'login' ? (
              <>
                <Text style={styles.brandTitle}>MooseCart</Text>
                <Text style={styles.brandSub}>powered by Meta Muse</Text>
                <Text style={styles.tagline}>Share (Type, Speak, Capture) your grocery list and MooseCart will find you the best offers to price match so that you can save more, with flyer proof.</Text>
                <Text style={styles.availLine} accessibilityLabel="Available in Canada for national retail chains. US coming soon.">
                  Available in Canada for national retail chains 🇨🇦 · US coming soon 🇺🇸
                </Text>
              </>
            ) : !activeStore ? (
              <View style={styles.topText}>
                <Text style={styles.topTitle}>{headerTitle}</Text>
              </View>
            ) : (
              <View style={styles.topText}>
                <Pressable
                  style={styles.storeRow}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCartOpen(false);
                    setScanning(false);
                    setScreen('stores');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Your store: ${headerTitle}. Change store.`}
                >
                  <MerchantAvatar name={headerTitle} size={26} />
                  <Text style={styles.topTitle}>Your store: {headerTitle}</Text>
                  <AppIcon name="edit" size={18} color={C.muted} />
                </Pressable>
                <Text style={styles.phaseText}>
                  <PhaseSpinner active={workingNow && !reduceMotion} />
                  {phaseLine()}
                </Text>
                {(store?.id === 'nofrills-milton' || store?.id === 'rcss-milton') && (
                  <Text style={[styles.meta, styles.centerText]}>
                    Matches major supermarkets per the store&apos;s in-store list — the cashier has final say.
                  </Text>
                )}
              </View>
            )}
          </View>

          {!busy && (
          <Animated.View
            style={[styles.body, screen === 'login' && styles.bodyCenter, { opacity: bodyFade }]}
          >
            {screen === 'login' ? (
              <>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.loginBtn, pressed && styles.pressed]}
                  android_ripple={{ color: C.pressedLight }}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setScreen('stores');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Log in to MooseCart"
                >
                  <Text style={styles.buttonText}>Login</Text>
                </Pressable>
                <Text style={styles.meta}>Hackathon build — login stays on this device, no account needed.</Text>
              </>
            ) : !activeStore ? (
              <ScrollView contentContainerStyle={[styles.container, isWeb && styles.webContainer]}>
                {locating ? (
                  <View style={styles.locating}>
                    <ActivityIndicator size="large" color={C.primary} />
                    <Text style={styles.meta}>Locating you…</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.storeSub}>Stores near you that price match (Your Location: Milton, ON).</Text>
                    {stores.map((s) => (
                      <Pressable
                        key={s.id}
                        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                        android_ripple={{ color: C.pressedDark }}
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setStore(s);
                          setPhase('awaiting');
                          setStatusLines([]);
                          setItems([]);
                          setPicks({});
                          setScreen('main');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Shop at ${s.name}`}
                      >
                        <View style={styles.storeRow}>
                          <MerchantAvatar name={s.chain} size={40} />
                          <View style={styles.cardText}>
                            <Text style={styles.name}>{s.name}</Text>
                            <Text style={styles.meta}>{s.address} · {s.distanceKm} km</Text>
                            <Text style={styles.meta}>{s.note}</Text>
                          </View>
                          <AppIcon name="chevron-right" size={28} color={C.primary} />
                        </View>
                      </Pressable>
                    ))}
                  </>
                )}
              </ScrollView>
            ) : cartOpen ? (
              <ScrollView contentContainerStyle={[styles.container, isWeb && styles.webContainer]}>
                <View style={styles.tabRow}>
                    <Pressable
                      style={[styles.tabBtn, cartTab === 'saved' && styles.tabBtnActive]}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setCartTab('saved');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Saved items"
                    >
                      <Text style={[styles.tabText, cartTab === 'saved' && styles.tabTextActive]}>Saved</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.tabBtn, cartTab === 'searches' && styles.tabBtnActive]}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setCartTab('searches');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Recent searches"
                    >
                      <Text style={[styles.tabText, cartTab === 'searches' && styles.tabTextActive]}>Recent searches</Text>
                    </Pressable>
                </View>
                {cartTab === 'saved' && sessions.length === 0 && (
                  <Text style={styles.meta}>No saved items yet — tap Save on any offer to start a session.</Text>
                )}
                {cartTab === 'saved' &&
                  sessions.map((s) => (
                    <View key={s.id} style={styles.sessionGroup}>
                      <Text style={styles.h}>{s.storeName}</Text>
                      <Text style={styles.meta}>{new Date(s.savedAt).toLocaleString()} · {s.picks.length} item{s.picks.length === 1 ? '' : 's'}</Text>
                      {s.picks.map((p) => (
                        <View
                          key={`${p.item}-${p.offer.dealId}`}
                          style={[styles.card, styles.pickRow]}
                        >
                          <Pressable
                            style={styles.pickText}
                            android_ripple={{ color: C.pressedDark }}
                            onPress={() => {
                              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setEvidence({ item: p.item, offer: p.offer, isReview: false, beatCents: p.beatCents });
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`${p.item}: ${p.offer.name}. Show flyer evidence.`}
                          >
                            <Text style={styles.name}>{p.item}: {p.offer.name}</Text>
                            <Text style={styles.meta}>{p.offer.merchant} · ${p.offer.currentPrice} {p.offer.currency} · tap to show flyer evidence</Text>
                          </Pressable>
                          <Pressable
                            style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                            onPress={() => {
                              void removePick(s.id, p.item, p.offer.dealId);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${p.item} from this session`}
                          >
                            <AppIcon name="close" size={20} color={C.danger} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ))}
                {cartTab === 'searches' &&
                  searches.map((r) => (
                    <Pressable
                      key={r.id}
                      style={styles.card}
                      android_ripple={{ color: C.pressedDark }}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (busy || !store) return;
                        setCartOpen(false);
                        void priceItems(
                          r.inputs,
                          `Re-run (${new Date(r.savedAt).toLocaleDateString()}): ${r.inputs.map((i) => i.name).join(', ')}`,
                          store,
                        );
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Re-run search for ${r.inputs.map((i) => i.name).join(', ')}. ${r.matched} of ${r.total} matched.`}
                    >
                      <Text style={styles.name}>{r.inputs.map((i) => i.name).join(', ')}</Text>
                      <Text style={styles.meta}>
                        {r.kind === 'photo' ? 'Photo' : r.kind === 'barcode' ? 'Barcode' : 'List'} · {r.storeName} · {new Date(r.savedAt).toLocaleString()} · {r.matched}/{r.total} matched
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>
            ) : (
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={[styles.container, isWeb && styles.webContainer]}
              >
                {typeOpen && (
                  <View style={styles.card}>
                    <Text style={styles.name}>Type your grocery list</Text>
                    <TextInput
                      style={styles.input}
                      value={typeDraft}
                      onChangeText={setTypeDraft}
                      onFocus={() => setTypeFocused(true)}
                      onBlur={() => setTypeFocused(false)}
                      placeholder={typeFocused ? '' : '"milk, eggs, oranges"'}
                      autoCapitalize="none"
                      multiline
                      accessibilityLabel="Grocery list"
                    />
                    <View style={styles.row}>
                      <Pressable
                        style={({ pressed }) => [styles.stubBtn, styles.rowBtn, pressed && styles.cardPressed]}
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setTypeOpen(false);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel typing"
                      >
                        <Text>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.button, styles.rowBtn, pressed && styles.pressed]}
                        onPress={() => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setTypeOpen(false);
                          void priceList(typeDraft, activeStore);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Find prices for typed list"
                      >
                        <Text style={styles.buttonText}>Find prices</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
                <View style={styles.statusBox}>
                  {recording && <Text style={styles.phaseText}>● {phaseLine()}</Text>}
                  <ScrollView
                    style={styles.statusScroll}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    {statusLines.length === 0 && !error && (
                      <Text style={styles.meta}>Tap the mic and tell the moose what you need.</Text>
                    )}
                    {statusLines.map((line, i) => (
                      <Text key={i} style={styles.statusLine}>→ {line}</Text>
                    ))}
                  </ScrollView>
                </View>
                {error && <Text style={styles.error}>{error}</Text>}

                {scanning && !isWeb && (
                  <>
                    <CameraView
                      style={styles.camera}
                      barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                      onBarcodeScanned={({ data }) => onBarcode(data)}
                    />
                    <Text style={styles.meta}>
                      {scannedCodes.length === 0
                        ? 'Point at barcodes — each one joins the batch.'
                        : `${scannedCodes.length}/10 scanned — keep going, or tap the QR button to price them.`}
                    </Text>
                  </>
                )}

                {items.map((item, itemIdx) => {
                  const eligible = item.search.confirmed.filter(
                    (o) => o.priceMatchable ?? o.priceMatchAtFreshCo,
                  );
                  const hiddenConfirmed = item.search.confirmed.filter(
                    (o) => !(o.priceMatchable ?? o.priceMatchAtFreshCo),
                  );
                  // Review items that are not matchable belong behind the
                  // link too; the visible review section is only for
                  // matchable-but-ambiguous candidates needing your call.
                  const hiddenReview = item.search.review.filter(
                    (o) => !(o.priceMatchable ?? o.priceMatchAtFreshCo),
                  );
                  const shownReview = item.search.review.filter(
                    (o) => o.priceMatchable ?? o.priceMatchAtFreshCo,
                  );
                  const hidden = [...hiddenConfirmed, ...hiddenReview];
                  return (
                    <View key={item.name} style={styles.section}>
                      <View style={[styles.strip, { backgroundColor: STRIP_COLORS[itemIdx % STRIP_COLORS.length] }]}>
                        <Text style={styles.h}>
                          {item.name}
                          {item.quantity ? ` × ${item.quantity}` : ''}
                        </Text>
                      </View>
                      {eligible.slice(0, 3).map((o) => (
                        <OfferCard key={o.dealId} item={item.name} offer={o} isReview={false} beatCents={item.search.beatCents ?? 1} />
                      ))}
                      {item.search.confirmed.length === 0 && (
                        <Text style={styles.meta}>No confirmed offer — stays unmatched, never guessed.</Text>
                      )}
                      {hidden.length > 0 && (
                        <Pressable
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSheet({ item: item.name, offers: hidden });
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Show ${hidden.length} deals that cannot be price matched for ${item.name}`}
                        >
                          <Text style={styles.moreLink}>
                            We found {hidden.length} more deal{hidden.length === 1 ? '' : 's'} which can't be price matched ›
                          </Text>
                        </Pressable>
                      )}
                      {shownReview.slice(0, 3).map((o) => (
                        <OfferCard key={o.dealId} item={item.name} offer={o} isReview beatCents={item.search.beatCents ?? 1} />
                      ))}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </Animated.View>
          )}

          {activeStore && !cartOpen && (
            <View style={styles.bottomBar}>
              {busy && (
                <>
                  <PulseDots active still={reduceMotion} />
                  <Pressable
                    style={({ pressed }) => [styles.stopBig, pressed && styles.pressed]}
                    android_ripple={{ color: C.pressedLight }}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      stopWork();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Stop and return to the main screen"
                  >
                    <AppIcon name="stop-circle" size={36} color="#ffffff" />
                    <Text style={styles.stopText}>Stop</Text>
                  </Pressable>
                  <PulseDots active still={reduceMotion} />
                </>
              )}
              {!busy && (
              <>
              <Pressable
                style={({ pressed }) => [styles.sideBtn, pressed && styles.pressed, busy && styles.disabled]}
                android_ripple={{ color: C.pressedLight }}
                disabled={busy}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPhotoChoiceOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Photograph groceries to identify them"
                accessibilityState={{ disabled: busy }}
              >
                <AppIcon name="photo-camera" size={24} color={C.onSecondary} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.sideBtn, scanning && styles.sideBtnDanger, pressed && styles.pressed]}
                android_ripple={{ color: C.pressedLight }}
                onPress={async () => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (isWeb) {
                    showToast('Barcode scanning lives in the Android and iPhone apps — the web app plans and prices your list.');
                    return;
                  }
                  if (scanning) {
                    // Finishing prices the accumulated batch (up to 10).
                    await lookupBarcodes(scannedCodes, activeStore);
                    return;
                  }
                  if (!camPermission?.granted) {
                    const p = await requestCamPermission();
                    if (!p.granted) {
                      setError('Camera permission denied — type the list instead');
                      return;
                    }
                  }
                  setScannedCodes([]);
                  setScanning(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={scanning ? `Finish scanning and price ${scannedCodes.length} barcodes` : 'Scan barcodes in store, up to 10'}
              >
                <AppIcon name={scanning ? 'stop-circle' : 'qr-code-scanner'} size={24} color={C.onSecondary} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.micBig,
                  recording && styles.micActive,
                  pressed && styles.pressed,
                  busy && styles.disabled,
                ]}
                android_ripple={{ color: C.pressedLight }}
                onPressIn={() => {
                  if (busy) return;
                  holdRef.current = { started: false, t: Date.now(), pressed: true };
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setWorkKind('list');
                  // Arm, don't record: warm the recorder now (overlaps the
                  // hold), and only capture once the hold qualifies.
                  warmPromise.current = warmRecorder();
                  if (holdTimer.current) clearTimeout(holdTimer.current);
                  holdTimer.current = setTimeout(() => {
                    holdTimer.current = null;
                    void (async () => {
                      if (!holdRef.current.pressed) return;
                      if (!(await warmPromise.current)) return;
                      if (!holdRef.current.pressed) return;
                      void beginRecording();
                    })();
                  }, 600);
                }}
                onPressOut={() => {
                  holdRef.current.pressed = false;
                  if (holdTimer.current) {
                    // Released before the hold threshold: a tap. The
                    // recorder was never started, so there is nothing to
                    // stop or discard — just teach the gesture.
                    clearTimeout(holdTimer.current);
                    holdTimer.current = null;
                    showToast('Hold the mic while you speak, release when done.');
                    return;
                  }
                  if (!holdRef.current.started) return;
                  holdRef.current.started = false;
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  void stopAndTranscribe(activeStore);
                }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={recording ? `Recording ${recSeconds} seconds, release to finish` : 'Press and hold the mic to dictate my grocery list'}
                accessibilityHint="Press and hold to record, release to send"
                accessibilityState={{ disabled: busy }}
              >
                <AppIcon name="mic" size={32} color={C.onSecondary} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.sideBtn, pressed && styles.pressed]}
                android_ripple={{ color: C.pressedLight }}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (!typeOpen) setTypeDraft('');
                  setTypeOpen((v) => !v);
                }}
                accessibilityRole="button"
                accessibilityLabel="Type my grocery list"
              >
                <AppIcon name="keyboard" size={24} color={C.onSecondary} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.sideBtn, pressed && styles.pressed]}
                android_ripple={{ color: C.pressedLight }}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  openCart();
                }}
                accessibilityRole="button"
                accessibilityLabel={`Open price-match sessions, ${savedCount} items saved`}
              >
                <View>
                  <AppIcon name="shopping-cart" size={24} color={C.onSecondary} />
                  {savedCount > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{savedCount}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
              </>
              )}
            </View>
          )}
          {activeStore && cartOpen && (
            <View style={styles.bottomBar}>
              <Pressable
                style={({ pressed }) => [styles.sideBtn, styles.sideBtnDanger, pressed && styles.pressed]}
                android_ripple={{ color: C.pressedLight }}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  closeCart();
                }}
                accessibilityRole="button"
                accessibilityLabel="Close price-match sessions and return to the main screen"
              >
                <AppIcon name="close" size={24} color={C.onSecondary} />
              </Pressable>
            </View>
          )}
        </View>

        {activeStore && (
          <>
            <Modal visible={photoChoiceOpen} animationType="fade" transparent onRequestClose={() => setPhotoChoiceOpen(false)}>
              <View style={styles.dialogBackdrop}>
                <View style={styles.dialog}>
                  <Text style={styles.h}>Photograph groceries</Text>
                  <Text style={styles.meta}>The moose looks at up to 10 photos (library) or one camera shot and lists what it sees. You confirm before anything is priced.</Text>
                  <Pressable
                    style={styles.button}
                    android_ripple={{ color: C.pressedLight }}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      void takePhoto(false, activeStore);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Take a photo"
                  >
                    <Text style={styles.buttonText}>Take photo</Text>
                  </Pressable>
                  <Pressable
                    style={styles.stubBtn}
                    android_ripple={{ color: C.pressedDark }}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      void takePhoto(true, activeStore);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Choose photo from library"
                  >
                    <Text>Choose from library</Text>
                  </Pressable>
                  <Pressable
                    style={styles.stubBtn}
                    android_ripple={{ color: C.pressedDark }}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPhotoChoiceOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel photo"
                  >
                    <Text>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>

            <Modal visible={seenOpen} animationType="slide" transparent onRequestClose={() => setSeenOpen(false)}>
              <View style={styles.dialogBackdrop}>
                <View style={styles.dialog}>
                  <Text style={styles.h}>Moose sees…</Text>
                  {seen && (
                    <>
                      <Text style={styles.meta}>"{seen.seen || 'groceries'}" ({seen.items.length} item{seen.items.length === 1 ? '' : 's'}) — confirm to price them.</Text>
                      <ScrollView style={styles.seenScroll} nestedScrollEnabled>
                      {seen.items.length === 0 && (
                        <Text style={styles.meta}>No grocery product recognised — try a closer shot or type the list.</Text>
                      )}
                        {seen.items.map((i) => (
                          <Text key={i.name} style={styles.name}>
                            · {i.name}{i.quantity ? ` × ${i.quantity}` : ''}{i.unit ? ` ${i.unit}` : ''}
                          </Text>
                        ))}
                      </ScrollView>
                    </>
                  )}
                  <View style={styles.row}>
                    <Pressable
                      style={[styles.stubBtn, styles.rowBtn]}
                      android_ripple={{ color: C.pressedDark }}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSeenOpen(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Discard seen items"
                    >
                      <Text>Not this</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.button, styles.rowBtn]}
                      android_ripple={{ color: C.pressedLight }}
                      disabled={!seen || seen.items.length === 0}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (!seen) return;
                        setSeenOpen(false);
                        void priceItems(seen.items, `Seen in photo: "${seen.seen || 'groceries'}"`, activeStore, undefined, 'photo');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Price the seen items"
                    >
                      <Text style={styles.buttonText}>Price these</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>
          </>
        )}

        <Modal visible={evidence !== null} animationType="slide" onRequestClose={() => setEvidence(null)}>
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={[styles.modal, isWeb && styles.webContainer]}>
              <Text style={[styles.title, styles.centerText]}>Flyer evidence</Text>
              {evidence && (
                <>
                  <View style={styles.evidenceHead}>
                    <MerchantAvatar name={evidence.offer.merchant} size={40} />
                    <View style={styles.cardText}>
                      <Text style={styles.name}>{evidence.offer.merchant} flyer</Text>
                      <Text style={styles.meta}>
                        Valid to {new Date(evidence.offer.validTo).toLocaleDateString()} · Flipp public search
                      </Text>
                    </View>
                  </View>
                  {evidence.offer.pageImageUrl ? (
                    <View>
                      <Text style={styles.meta}>Full flyer page for context — the cutout below is the matched item.</Text>
                      <EvidenceImage key={`page-${evidence.offer.dealId}`} uri={evidence.offer.pageImageUrl} />
                    </View>
                  ) : null}
                  <EvidenceImage key={evidence.offer.dealId} uri={evidence.offer.imageUrl} />
                  <Text style={styles.name}>{evidence.offer.name}</Text>
                  <Text style={styles.priceHero}>
                    ${evidence.offer.currentPrice} {evidence.offer.currency}
                    {evidence.offer.priceBasis.raw ? ` (${evidence.offer.priceBasis.raw})` : ''}
                  </Text>
                  <Text style={styles.meta}>
                    Source: flyer data published by merchants.{' '}
                    {evidence.beatCents == null
                      ? `Show this at the ${chainName} till.`
                      : evidence.beatCents > 0
                        ? `Show this at the ${chainName} till for 1¢ under the competitor price.`
                        : `Show this at the ${chainName} till at the competitor's advertised price.`}
                  </Text>
                  {evidence.isReview && (
                    <Pressable
                      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                      android_ripple={{ color: C.pressedLight }}
                      onPress={() => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPicks((prev) => ({ ...prev, [evidence.item]: evidence.offer }));
                        setEvidence(null);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Use this offer for ${evidence.item}`}
                    >
                      <Text style={styles.buttonText}>Use this one for {evidence.item}</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.mic, pressed && styles.pressed]}
                    android_ripple={{ color: C.pressedLight }}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setEvidence(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Close flyer evidence"
                  >
                    <Text style={styles.micText}>Close</Text>
                  </Pressable>

                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={sheet !== null}
          animationType="slide"
          transparent
          onRequestClose={() => setSheet(null)}
        >
          <View style={styles.sheetBackdrop}>
            <View style={styles.sheet}>
              <Text style={styles.h}>
                {sheet ? `Can't price match: ${sheet.item}` : ''}
              </Text>
              {sheet && (
                <ScrollView style={styles.sheetScroll} nestedScrollEnabled>
                  {sheet.offers.map((o) => (
                    <OfferCard key={o.dealId} item={sheet.item} offer={o} isReview={false} beatCents={1} />
                  ))}
                </ScrollView>
              )}
              <Pressable
                style={({ pressed }) => [styles.mic, pressed && styles.pressed]}
                android_ripple={{ color: C.pressedLight }}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSheet(null);
                }}
                accessibilityRole="button"
                accessibilityLabel="Close non-matchable deals"
              >
                <Text style={styles.micText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {toast && (
          <View style={styles.toast} accessible accessibilityLabel={toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}
        <StatusBar style="auto" />
      </SafeAreaView>
    </SafeAreaProvider>
    </View>
  );
}


const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  shell: { flex: 1 },
  shellCenter: { justifyContent: 'center' },
  body: { flex: 1 },
  bodyCenter: { flex: 0, alignItems: 'center', padding: 24, gap: 12 },
  heroHeader: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  container: { padding: 16, gap: 12, paddingBottom: 24 },
  title: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 26, color: C.text },
  brandTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 44, color: C.text, letterSpacing: 0.5 },
  brandSub: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 15, color: C.muted },
  tagline: { fontFamily: 'SpaceGrotesk_400Regular', fontSize: 14, color: C.text, textAlign: 'center', paddingHorizontal: 32 },
  storeSub: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 16, color: C.text },
  availLine: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: C.muted, textAlign: 'center' },
  spinner: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: C.primary },
  loginBtn: { minWidth: 200, marginTop: 12 },
  orb: { overflow: 'hidden', backgroundColor: '#fff' },
  topBar: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
    backgroundColor: '#fff',
    // Lifted top layer: the body scrolls beneath it.
    ...Platform.select({
      android: { elevation: 4 },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
    }),
  },
  topText: { gap: 2, alignItems: 'center' },
  topTitle: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 18, color: C.text, textAlign: 'center' },
  phaseText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: C.primary, textAlign: 'center' },
  cartBtn: {
    position: 'absolute',
    right: 8,
    top: 8,
    padding: 8,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: C.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: { fontFamily: 'SpaceGrotesk_700Bold', color: '#fff', fontSize: 12 },
  statusBox: { backgroundColor: C.traceBg, borderRadius: 8, padding: 12, gap: 4 },
  statusLine: { fontFamily: 'SpaceGrotesk_400Regular', color: C.traceText, fontSize: 14 },
  error: { fontFamily: 'SpaceGrotesk_500Medium', color: C.danger },
  evidenceHead: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  priceHero: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 28, color: C.primary },
  section: { gap: 8 },
  h: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 19, marginTop: 8, textTransform: 'capitalize', color: C.text },
  card: { borderWidth: 1, borderColor: C.cardBorder, borderRadius: 8, padding: 12, gap: 8 },
  cardMain: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cardText: { flex: 1, gap: 2 },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: C.imageBg },
  pickedCard: { borderColor: C.primary, borderWidth: 2 },
  reviewCard: { borderColor: C.warningBorder, backgroundColor: C.warningBg },
  cardPressed: { backgroundColor: '#f0f0f0' },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 8,
    minHeight: 44,
  },
  savedBtn: { borderColor: C.primary, backgroundColor: C.orbRing },
  saveText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: C.muted },
  savedText: { color: C.primary },
  storeRow: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  locating: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  strip: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  moreLink: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, color: C.secondary, paddingVertical: 4 },
  pickBadge: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: C.primary },
  tick: { fontFamily: 'SpaceGrotesk_700Bold', color: C.primary },
  dotsRow: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.secondary },
  stopBig: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 140,
    minHeight: 76,
    borderRadius: 38,
    backgroundColor: C.danger,
    paddingHorizontal: 20,
  },
  stopText: { fontFamily: 'SpaceGrotesk_700Bold', color: '#ffffff', fontSize: 18 },
  pickRow: { flexDirection: 'row', alignItems: 'center' },
  pickText: { flex: 1 },
  sessionGroup: { gap: 8, marginBottom: 16 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  tabText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, color: C.text },
  tabTextActive: { color: '#ffffff' },
  removeBtn: {
    padding: 12,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    backgroundColor: '#ffffff',
    // Pins the bar to the bottom by layout in every state — no centering
    // hacks. Harmless when the flex:1 body above already fills the space.
    marginTop: 'auto',
  },
  roundBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // QR button doubles as Finish/stop while scanning: red like Stop.
  sideBtnDanger: { backgroundColor: C.danger },
  micBig: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micActive: { backgroundColor: C.danger },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  mic: { backgroundColor: C.secondary, borderRadius: 8, padding: 16, alignItems: 'center', minHeight: 56 },
  micText: { fontFamily: 'SpaceGrotesk_700Bold', color: C.onSecondary, fontSize: 16 },
  button: { backgroundColor: C.primary, borderRadius: 8, padding: 16, alignItems: 'center', minHeight: 56 },
  buttonText: { fontFamily: 'SpaceGrotesk_700Bold', color: C.onPrimary, fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 56,
    textAlignVertical: 'top',
    color: C.text,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  row: { flexDirection: 'row', gap: 8 },
  rowBtn: { flex: 1 },
  stubBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, alignItems: 'center', minHeight: 48 },
  modal: { padding: 16, paddingTop: 28, gap: 12 },
  centerText: { textAlign: 'center' },
  dialogBackdrop: { flex: 1, backgroundColor: C.backdrop, justifyContent: 'center', padding: 24 },
  sheetBackdrop: { flex: 1, backgroundColor: C.backdrop, justifyContent: 'flex-end' },
  dialog: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, gap: 12, width: '100%', maxWidth: 420, alignSelf: 'center' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 12,
    maxHeight: '80%',
  },
  sheetScroll: { gap: 8 },
  seenScroll: { maxHeight: 320 },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 110,
    backgroundColor: C.text,
    borderRadius: 10,
    padding: 12,
  },
  toastText: { fontFamily: 'SpaceGrotesk_500Medium', color: '#ffffff', fontSize: 13, textAlign: 'center' },
  evidenceImg: { width: '100%', height: 420, backgroundColor: C.imageBg, borderRadius: 8 },
  evidenceFallback: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  camera: { height: 320, borderRadius: 8, overflow: 'hidden' },
  name: { fontFamily: 'SpaceGrotesk_700Bold', color: C.text, fontSize: 15 },
  meta: { fontFamily: 'SpaceGrotesk_400Regular', color: C.muted, fontSize: 13 },
  backLink: { paddingVertical: 8 },
  backLinkText: { fontFamily: 'SpaceGrotesk_700Bold', color: C.secondary, fontSize: 15 },
  webContainer: { width: '100%' },
  statusScroll: { maxHeight: 160 },
  // Web runs full-bleed: no phone-width column, the layout adjusts to
  // the device and window size.
  webPage: { backgroundColor: '#ffffff' },
  safeWeb: { width: '100%', alignSelf: 'stretch' },
});

