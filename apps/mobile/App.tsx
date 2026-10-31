import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  BackHandler,
  Dimensions,
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
} as const;

type IconName = keyof typeof ICON_PATHS | 'bookmark-border';

function AppIcon({ name, size = 24, color = C.text }: { name: IconName; size?: number; color?: string }) {
  if (name === 'bookmark-border') {
    return (
      <Svg width={size} height={size} viewBox="0 -960 960 960">
        <Path d={ICON_PATHS.bookmark} fill="none" stroke={color} strokeWidth={80} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960">
      <Path d={ICON_PATHS[name]} fill={color} />
    </Svg>
  );
}
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
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

type MooseState = keyof typeof MOOSE_CLIPS;

function useLoopPlayer(source: number) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
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

function MooseOrb({ state, size = 120, still = false }: { state: MooseState; size?: number; still?: boolean }) {
  if (still) {
    return (
      <View style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }]}>
        <Image
          source={require('./assets/moose/logo.webp')}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
          accessibilityLabel="MooseCart moose"
        />
      </View>
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
  return (
    <View
      style={[
        styles.orb,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
      accessible={false}
    >
      <VideoView
        player={players[state]}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
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

type SavedPick = { item: string; offer: Offer };

type Session = {
  id: string;
  savedAt: string;
  storeId: string;
  storeName: string;
  picks: SavedPick[];
};

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
  awaiting: 'Awaiting your shopping list',
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
    case 'done':
      return 'success';
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

export default function App() {
  const [screen, setScreen] = useState<'login' | 'stores' | 'main'>('login');
  const [stores, setStores] = useState<Store[]>(FALLBACK_STORES);
  const [store, setStore] = useState<Store | null>(null);
  const [phase, setPhase] = useState<Phase>('awaiting');
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [items, setItems] = useState<ItemResult[]>([]);
  const [picks, setPicks] = useState<Record<string, Offer>>({});
  const [sessions, setSessions] = useState<Session[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<{ item: string; offer: Offer; isReview: boolean } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartSessionId, setCartSessionId] = useState<string | null>(null);
  const cartX = useRef(new Animated.Value(Dimensions.get('window').width)).current;

  function openCart() {
    setCartSessionId(null);
    setCartOpen(true);
    Animated.timing(cartX, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  }

  function closeCart() {
    Animated.timing(cartX, {
      toValue: Dimensions.get('window').width,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setCartOpen(false);
    });
  }

  useEffect(() => {
    if (!cartOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeCart();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartOpen]);
  const [typeOpen, setTypeOpen] = useState(false);
  const [typeDraft, setTypeDraft] = useState('');
  const [scanning, setScanning] = useState(false);
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollRef = useRef<any>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
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
      try {
        const res = await fetch(`${API_URL}/stores`);
        if (res.ok) {
          const data = (await res.json()) as { stores: Store[] };
          if (Array.isArray(data.stores) && data.stores.length) setStores(data.stores);
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

  // If custom fonts are blocked or fail to decode (ad blockers, flaky
  // networks), fall back to system fonts rather than a blank screen.
  if (!fontsLoaded && !fontsTimedOut) return null;

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
  ) {
    setPhase('matching');
    const lines: string[] = [
      firstLine,
      `Parsed ${parsedItems.length} item${parsedItems.length === 1 ? '' : 's'}: ${parsedItems.map((i) => i.name).join(', ')}`,
      'Matching offers…',
    ];
    setStatusLines([...lines]);
    const results: ItemResult[] = [];
    let beatCents = 1;
    for (const item of parsedItems) {
      const res = await fetch(
        `${API_URL}/search?q=${encodeURIComponent(item.name)}&store=${encodeURIComponent(activeStore.id)}`,
      );
      if (!res.ok) throw new Error(`search ${res.status}`);
      const search = (await res.json()) as SearchResult;
      if (typeof search.beatCents === 'number') beatCents = search.beatCents;
      results.push({ name: item.name, quantity: item.quantity, search });
    }
    setItems(results);
    const matched = results.filter((r) => r.search.confirmed.length > 0).length;
    const needsCall = results.reduce((n, r) => n + r.search.review.length, 0);
    const payableFor = (r: ItemResult) => {
      const top =
        r.search.confirmed.find((o) => o.priceMatchable ?? o.priceMatchAtFreshCo) ??
        r.search.confirmed[0];
      if (!top) return 0;
      return beatFor(top, beatCents);
    };
    const total = results.reduce((sum, r) => sum + payableFor(r), 0);
    const anyEligible = results.some((r) =>
      r.search.confirmed.some((o) => o.priceMatchable ?? o.priceMatchAtFreshCo),
    );
    lines.push(
      `Matched ${matched}/${results.length} items · ${needsCall} candidate${needsCall === 1 ? '' : 's'} need your call`,
      matched
        ? anyEligible
          ? `Basket payable at ${activeStore.name} (best eligible match per item): $${total.toFixed(2)} CAD`
          : `Flyer prices found, but none are price-matchable at ${activeStore.name} — basket at flyer prices: $${total.toFixed(2)} CAD`
        : 'No confirmed matches yet — nothing priced by guesswork.',
    );
    setStatusLines([...lines]);
    setPhase('done');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  }

  async function priceList(text: string, activeStore: Store, firstTraceLine?: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
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
      });
      if (!parseRes.ok) throw new Error(`parse ${parseRes.status}`);
      const parsed = (await parseRes.json()) as {
        items: { name: string; quantity: number | null }[];
      };
      await priceItems(parsed.items, lines[0], activeStore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
      setPhase('error');
      setStatusLines([...lines, 'Failed — check the backend is running']);
    } finally {
      setBusy(false);
    }
  }

  async function onBarcode(barcode: string, activeStore: Store) {
    if (barcode === lastBarcode) return; // suppress duplicate callbacks
    setLastBarcode(barcode);
    setScanning(false);
    setPhase('reading');
    setStatusLines([`Scanned barcode ${barcode}`, 'Looking up product identity…']);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      const data = (await res.json()) as {
        status?: number;
        product?: { product_name?: string; brands?: string; quantity?: string };
      };
      const name = data.product?.product_name?.trim();
      if (!res.ok || data.status !== 1 || !name) {
        setStatusLines([`Scanned barcode ${barcode}`, 'Product not found — type the item instead']);
        setPhase('awaiting');
        return;
      }
      setPhase('parsing');
      await priceList(name, activeStore, `Scanned: ${name}`);
    } catch {
      setStatusLines([`Scanned barcode ${barcode}`, 'Lookup failed — type the item instead']);
      setPhase('awaiting');
    }
  }

  async function startRecording() {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError('Microphone permission denied — type the list instead');
        return;
      }
      await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setError(null);
      setPhase('listening');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not start recording');
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
      const res = await fetch(`${API_URL}/dictate`, {
        method: 'POST',
        headers: { 'Content-Type': isWeb ? 'audio/webm' : 'audio/m4a' },
        body: bytes as unknown as BodyInit,
      });
      if (!res.ok)
        throw new Error(
          'Could not understand that recording — speak closer to the mic and try again, or type the list',
        );
      const data = (await res.json()) as {
        transcript: string;
        items: { name: string; quantity: number | null }[];
      };
      await priceItems(data.items, `Heard: "${data.transcript}"`, activeStore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'dictation failed');
      setPhase('error');
    } finally {
      setBusy(false);
    }
  }

  // Per-offer Save: drops the offer into today's session for this store
  // (creating the session on first save).
  async function saveOffer(item: string, offer: Offer) {
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
        { item, offer },
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
    return (
      <View style={[styles.card, isReview && styles.reviewCard, picked && styles.pickedCard]}>
        <Pressable
          style={styles.cardMain}
          android_ripple={{ color: C.pressedDark }}
          onPress={() => setEvidence({ item, offer, isReview })}
          accessibilityRole="button"
          accessibilityLabel={`${offer.name}, ${offer.merchant}, $${offer.currentPrice} ${offer.currency}. Show flyer evidence.`}
        >
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
              {matchable
                ? `✓ price-matchable at ${chainName} — you pay $${beatFor(offer, beatCents).toFixed(2)}`
                : `✗ not price-matchable at ${chainName} (outside its program)`}
            </Text>
          </View>
          <Image source={{ uri: offer.imageUrl }} style={styles.thumb} resizeMode="cover" />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.saveBtn, saved && styles.savedBtn, pressed && styles.cardPressed]}
          android_ripple={{ color: C.pressedDark }}
          onPress={() => void saveOffer(item, offer)}
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

  const cartSession = sessions.find((s) => s.id === cartSessionId) ?? null;

  // ---- Login ----
  if (screen === 'login') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.centerWrap}>
            <MooseOrb state="idle" size={280} still={reduceMotion} />
            <Text style={styles.brandTitle}>MooseCart</Text>
            <Text style={styles.brandSub}>powered by Meta Muse</Text>
            <Pressable
              style={({ pressed }) => [styles.button, styles.loginBtn, pressed && styles.pressed]}
              android_ripple={{ color: C.pressedLight }}
              onPress={() => setScreen('stores')}
              accessibilityRole="button"
              accessibilityLabel="Log in to MooseCart"
            >
              <Text style={styles.buttonText}>Login</Text>
            </Pressable>
            <Text style={styles.meta}>Demo build — login stays on this device, no account needed.</Text>
          </View>
          <StatusBar style="auto" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // ---- Stores near you ----
  if (screen === 'stores' || !store) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.topBar}>
            <MooseOrb state="idle" size={112} still={reduceMotion} />
            <Text style={styles.topTitle}>Stores near you</Text>
          </View>
          <ScrollView contentContainerStyle={[styles.container, isWeb && styles.webContainer]}>
            <Text style={styles.meta}>Price matching programs we can check for you around Milton, ON.</Text>
            {stores.map((s) => (
              <Pressable
                key={s.id}
                style={({ pressed }) => [styles.card, pressed && s.enabled && styles.cardPressed]}
                android_ripple={{ color: C.pressedDark }}
                disabled={!s.enabled}
                onPress={() => {
                  setStore(s);
                  setPhase('awaiting');
                  setStatusLines([]);
                  setItems([]);
                  setPicks({});
                  setScreen('main');
                }}
                accessibilityRole="button"
                accessibilityLabel={s.enabled ? `Shop at ${s.name}` : `${s.name}, coming soon`}
              >
                <View style={styles.storeRow}>
                  <View style={styles.cardText}>
                    <Text style={styles.name}>{s.name}</Text>
                    <Text style={styles.meta}>{s.address} · {s.distanceKm} km</Text>
                    <Text style={styles.meta}>{s.note}</Text>
                  </View>
                  {s.enabled ? (
                    <AppIcon name="chevron-right" size={28} color={C.primary} />
                  ) : (
                    <Text style={styles.soonBadge}>Coming soon</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <StatusBar style="auto" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // ---- Main ----
  const moose = mooseForPhase(phase);
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <MooseOrb state={moose} size={112} still={reduceMotion} />
          <View style={styles.topText}>
            <Text style={styles.topTitle}>{store.name}</Text>
            <Text style={styles.phaseText}>{PHASE_LABEL[phase]}</Text>
          </View>
          <Pressable
            style={styles.cartBtn}
            android_ripple={{ color: C.pressedDark }}
            onPress={openCart}
            accessibilityRole="button"
            accessibilityLabel={`Open price-match sessions, ${savedCount} items saved`}
          >
            <AppIcon name="shopping-cart" size={26} color={C.text} />
            {savedCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{savedCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.container, isWeb && styles.webContainer]}
        >
          <View style={styles.statusBox}>
            {recording && <Text style={styles.phaseText}>● Recording… {recSeconds}s</Text>}
            {statusLines.length === 0 && !error && (
              <Text style={styles.meta}>Tap the mic and tell the moose what you need.</Text>
            )}
            {statusLines.map((line, i) => (
              <Text key={i} style={styles.statusLine}>→ {line}</Text>
            ))}
          </View>
          {error && <Text style={styles.error}>{error}</Text>}

          {scanning && !isWeb && (
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
              onBarcodeScanned={({ data }) => void onBarcode(data, store)}
            />
          )}
          {isWeb && (
            <Text style={styles.meta}>Barcode scanning lives in the Android and iPhone apps — the web app plans and prices your list.</Text>
          )}

          {items.map((item) => (
            <View key={item.name} style={styles.section}>
              <Text style={styles.h}>
                {item.name}
                {item.quantity ? ` × ${item.quantity}` : ''}
              </Text>
              {item.search.confirmed.slice(0, 3).map((o) => (
                <OfferCard key={o.dealId} item={item.name} offer={o} isReview={false} beatCents={item.search.beatCents ?? 1} />
              ))}
              {item.search.confirmed.length === 0 && (
                <Text style={styles.meta}>No confirmed offer — stays unmatched, never guessed.</Text>
              )}
              {item.search.review.slice(0, 3).map((o) => (
                <OfferCard key={o.dealId} item={item.name} offer={o} isReview beatCents={item.search.beatCents ?? 1} />
              ))}
            </View>
          ))}
        </ScrollView>

        <View style={styles.bottomBar}>
          {!isWeb && (
            <Pressable
              style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
              android_ripple={{ color: C.pressedLight }}
              onPress={async () => {
                if (scanning) {
                  setScanning(false);
                  return;
                }
                if (!camPermission?.granted) {
                  const p = await requestCamPermission();
                  if (!p.granted) {
                    setError('Camera permission denied — type the list instead');
                    return;
                  }
                }
                setLastBarcode(null);
                setScanning(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={scanning ? 'Stop barcode scanner' : 'Scan a barcode in store'}
            >
              <AppIcon name={scanning ? 'stop-circle' : 'qr-code-scanner'} size={24} color={C.onSecondary} />
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.micBig,
              recording && styles.micActive,
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
            android_ripple={{ color: C.pressedLight }}
            onPress={recording ? () => void stopAndTranscribe(store) : startRecording}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={recording ? `Stop recording and transcribe, ${recSeconds} seconds` : 'Dictate my grocery list by voice'}
            accessibilityState={{ disabled: busy }}
          >
            <AppIcon
              name={recording ? 'stop-circle' : 'mic'}
              size={32}
              color={C.onSecondary}
            />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
            android_ripple={{ color: C.pressedLight }}
            onPress={() => {
              setTypeDraft('');
              setTypeOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Type my grocery list"
          >
            <AppIcon name="keyboard" size={24} color={C.onSecondary} />
          </Pressable>
        </View>

        <Modal visible={typeOpen} animationType="slide" transparent onRequestClose={() => setTypeOpen(false)}>
          <View style={styles.dialogBackdrop}>
            <View style={styles.dialog}>
              <Text style={styles.h}>Type your grocery list</Text>
              <TextInput
                style={styles.input}
                value={typeDraft}
                onChangeText={setTypeDraft}
                placeholder={'"milk, eggs, oranges"'}
                autoCapitalize="none"
                multiline
                accessibilityLabel="Grocery list"
              />
              <View style={styles.row}>
                <Pressable
                  style={({ pressed }) => [styles.stubBtn, styles.rowBtn, pressed && styles.cardPressed]}
                  onPress={() => setTypeOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel typing"
                >
                  <Text>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.button, styles.rowBtn, pressed && styles.pressed]}
                  onPress={() => {
                    setTypeOpen(false);
                    void priceList(typeDraft, store);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Find prices for typed list"
                >
                  <Text style={styles.buttonText}>Find prices</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {cartOpen && (
        <Animated.View style={[styles.cartSheet, { transform: [{ translateX: cartX }] }]}>
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={[styles.modal, isWeb && styles.webContainer]}>
              <View style={styles.modalOrb}>
                <MooseOrb state="idle" size={112} still={reduceMotion} />
              </View>
              <Text style={[styles.title, styles.centerText]}>Price-match sessions</Text>
              {sessions.length === 0 && (
                <Text style={styles.meta}>No saved items yet — tap Save on any offer to start a session.</Text>
              )}
              {!cartSession &&
                sessions.map((s) => (
                  <Pressable
                    key={s.id}
                    style={styles.card}
                    android_ripple={{ color: C.pressedDark }}
                    onPress={() => setCartSessionId(s.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open session at ${s.storeName}, ${s.picks.length} items`}
                  >
                    <Text style={styles.name}>{s.storeName} · {s.picks.length} item{s.picks.length === 1 ? '' : 's'}</Text>
                    <Text style={styles.meta}>{new Date(s.savedAt).toLocaleString()}</Text>
                  </Pressable>
                ))}
              {cartSession && (
                <>
                  <Pressable
                    style={styles.backLink}
                    onPress={() => setCartSessionId(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Back to all sessions"
                  >
                    <Text style={styles.backLinkText}>‹ All sessions</Text>
                  </Pressable>
                  <Text style={styles.h}>{cartSession.storeName}</Text>
                  <Text style={styles.meta}>{new Date(cartSession.savedAt).toLocaleString()}</Text>
                  {cartSession.picks.map((p) => (
                    <Pressable
                      key={`${p.item}-${p.offer.dealId}`}
                      style={styles.card}
                      android_ripple={{ color: C.pressedDark }}
                      onPress={() => setEvidence({ item: p.item, offer: p.offer, isReview: false })}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.item}: ${p.offer.name}. Show flyer evidence.`}
                    >
                      <Text style={styles.name}>{p.item}: {p.offer.name}</Text>
                      <Text style={styles.meta}>{p.offer.merchant} · ${p.offer.currentPrice} {p.offer.currency} · tap to show flyer evidence</Text>
                    </Pressable>
                  ))}
                </>
              )}
              <Pressable
                style={styles.mic}
                android_ripple={{ color: C.pressedLight }}
                onPress={closeCart}
                accessibilityRole="button"
                accessibilityLabel="Close sessions"
              >
                <Text style={styles.micText}>Close</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
        )}

        <Modal visible={evidence !== null} animationType="slide" onRequestClose={() => setEvidence(null)}>
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={[styles.modal, isWeb && styles.webContainer]}>
              <View style={styles.modalOrb}>
                <MooseOrb state="idle" size={112} still={reduceMotion} />
              </View>
              <Text style={[styles.title, styles.centerText]}>Flyer evidence</Text>
              {evidence && (
                <>
                  <EvidenceImage key={evidence.offer.dealId} uri={evidence.offer.imageUrl} />
                  <Text style={styles.name}>{evidence.offer.name}</Text>
                  <Text style={styles.meta}>
                    {evidence.offer.merchant} · ${evidence.offer.currentPrice} {evidence.offer.currency}
                    {evidence.offer.priceBasis.raw ? ` (${evidence.offer.priceBasis.raw})` : ''}
                  </Text>
                  <Text style={styles.meta}>
                    Valid to {new Date(evidence.offer.validTo).toLocaleDateString()} · Source: Flipp public search (flyer data published by merchants)
                  </Text>
                  {evidence.isReview && (
                    <Pressable
                      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                      android_ripple={{ color: C.pressedLight }}
                      onPress={() => {
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
                    onPress={() => setEvidence(null)}
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
        <StatusBar style="auto" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  container: { padding: 16, gap: 12, paddingBottom: 24 },
  title: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 26, color: C.text },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  brandTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 44, color: C.text, letterSpacing: 0.5 },
  brandSub: { fontFamily: 'Nunito_600SemiBold', fontSize: 15, color: C.muted },
  loginBtn: { minWidth: 200, marginTop: 12 },
  orb: { overflow: 'hidden', backgroundColor: C.orbRing },
  topBar: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
    backgroundColor: '#ffffff',
  },
  topText: { gap: 2, alignItems: 'center' },
  topTitle: { fontFamily: 'SpaceGrotesk_500Medium', fontSize: 18, color: C.text, textAlign: 'center' },
  phaseText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: C.primary, textAlign: 'center' },
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
  cartBadgeText: { fontFamily: 'Nunito_700Bold', color: '#fff', fontSize: 12 },
  statusBox: { backgroundColor: C.traceBg, borderRadius: 8, padding: 12, gap: 4 },
  statusLine: { fontFamily: 'Nunito_400Regular', color: C.traceText, fontSize: 14 },
  error: { fontFamily: 'Nunito_600SemiBold', color: C.danger },
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
  saveText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: C.muted },
  savedText: { color: C.primary },
  storeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  soonBadge: { fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    fontWeight: '700',
    color: C.muted,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
  },
  roundBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  micText: { fontFamily: 'Nunito_700Bold', color: C.onSecondary, fontSize: 16 },
  button: { backgroundColor: C.primary, borderRadius: 8, padding: 16, alignItems: 'center', minHeight: 56 },
  buttonText: { fontFamily: 'Nunito_700Bold', color: C.onPrimary, fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 56,
    textAlignVertical: 'top',
    color: C.text,
    fontFamily: 'Nunito_400Regular',
  },
  row: { flexDirection: 'row', gap: 8 },
  rowBtn: { flex: 1 },
  stubBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, alignItems: 'center', minHeight: 48 },
  modal: { padding: 16, gap: 12 },
  cartSheet: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    elevation: 8,
  },
  modalOrb: { alignItems: 'center', marginBottom: 4 },
  centerText: { textAlign: 'center' },
  dialogBackdrop: { flex: 1, backgroundColor: C.backdrop, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, gap: 12 },
  evidenceImg: { width: '100%', height: 320, backgroundColor: C.imageBg, borderRadius: 8 },
  evidenceFallback: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  camera: { height: 320, borderRadius: 8, overflow: 'hidden' },
  name: { fontFamily: 'Nunito_700Bold', color: C.text, fontSize: 15 },
  meta: { fontFamily: 'Nunito_400Regular', color: C.muted, fontSize: 13 },
  backLink: { paddingVertical: 8 },
  backLinkText: { fontFamily: 'Nunito_700Bold', color: C.secondary, fontSize: 15 },
  webContainer: { maxWidth: 640, width: '100%', alignSelf: 'center' },
});

