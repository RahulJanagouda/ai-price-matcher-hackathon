import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
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
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  border: '#c9c9c9',
  cardBorder: '#dcdcdc',
  traceBg: '#eef6f0',
  traceText: '#1f3652',
  imageBg: '#f4f4f4',
  pressedLight: 'rgba(255,255,255,0.25)',
  pressedDark: 'rgba(0,0,0,0.12)',
};

// Backend base URL: deployed Cloudflare Worker by default. Override with
// EXPO_PUBLIC_API_URL for the local dev backend (e.g. http://127.0.0.1:8787
// over USB reverse), which also provides /transcribe-file (m4a → WAV
// conversion) that the hosted Worker does not.
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://ai-price-matcher-api.satya-3bf.workers.dev';

type Offer = {
  dealId: number;
  name: string;
  merchant: string;
  currentPrice: number;
  currency: string;
  priceBasis: { unit: string; raw: string | null };
  priceMatchAtFreshCo?: boolean;
  validTo: string;
  imageUrl: string;
  reviewReason?: string;
};

type SearchResult = {
  confirmed: Offer[];
  review: Offer[];
  excludedCount: number;
};

type ItemResult = {
  name: string;
  quantity: number | null;
  search: SearchResult;
};

type SavedPlan = {
  savedAt: string;
  homeStore: string;
  picks: { item: string; offer: Offer }[];
};

const planFile = () => new File(Paths.document, 'saved-plan.json');

// Flyer snippet with loading and failure states: never a silent blank box.
function EvidenceImage({ uri }: { uri: string }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={[styles.evidenceImg, styles.evidenceFallback]}>
        <MaterialIcons name="broken-image" size={40} color={C.muted} accessible={false} />
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

export default function App() {
  const [listText, setListText] = useState('');
  const [trace, setTrace] = useState<string[]>([]);
  const [items, setItems] = useState<ItemResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<{ item: string; offer: Offer; isReview: boolean } | null>(null);
  const [picks, setPicks] = useState<Record<string, Offer>>({});
  const [savedPlan, setSavedPlan] = useState<SavedPlan | null>(null);
  const [cashierMode, setCashierMode] = useState(false);
  const [stub, setStub] = useState<'account' | 'subscription' | null>(null);
  const [scanning, setScanning] = useState(false);
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);

  async function onBarcode(barcode: string) {
    if (barcode === lastBarcode) return; // suppress duplicate callbacks
    setLastBarcode(barcode);
    setScanning(false);
    setTrace([`Scanned barcode ${barcode}`, 'Looking up product identity…']);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      const data = (await res.json()) as {
        status?: number;
        product?: { product_name?: string; brands?: string; quantity?: string };
      };
      const name = data.product?.product_name?.trim();
      if (!res.ok || data.status !== 1 || !name) {
        setTrace([`Scanned barcode ${barcode}`, 'Product not found — type the item instead']);
        return;
      }
      const label = [data.product?.brands, name, data.product?.quantity].filter(Boolean).join(' ');
      setListText(label);
      await priceList(name, `Scanned: ${label}`);
    } catch {
      setTrace([`Scanned barcode ${barcode}`, 'Lookup failed — type the item instead']);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const f = planFile();
        if (f.exists) setSavedPlan(JSON.parse(await f.text()) as SavedPlan);
      } catch {
        // No saved plan yet; cashier view stays empty until one is saved.
      }
    })();
  }, []);

  function currentPicks(): { item: string; offer: Offer }[] {
    return items
      .map((r) => {
        const offer = picks[r.name] ?? r.search.confirmed[0];
        return offer ? { item: r.name, offer } : null;
      })
      .filter((p): p is { item: string; offer: Offer } => p !== null);
  }

  async function savePlan() {
    const plan: SavedPlan = {
      savedAt: new Date().toISOString(),
      homeStore: 'FreshCo, Milton',
      picks: currentPicks(),
    };
    try {
      const f = planFile();
      if (!f.exists) f.create();
      f.write(JSON.stringify(plan));
      setSavedPlan(plan);
      setTrace((t) => [...t, `Saved plan with ${plan.picks.length} item(s) for cashier retrieval`]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not save plan');
    }
  }

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);

  useEffect(() => {
    if (!recording) return;
    setRecSeconds(0);
    const t = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not start recording');
    }
  }

  async function stopAndTranscribe() {
    try {
      await recorder.stop();
      setRecording(false);
      const uri = recorder.uri ?? recorder.getStatus().url;
      if (!uri) throw new Error('no recording captured');
      setBusy(true);
      setTrace(['Sending your voice list to Muse Spark Open…']);
      const bytes = await new File(uri).bytes();
      const res = await fetch(`${API_URL}/dictate`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/m4a' },
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
      if (data.transcript) setListText(data.transcript);
      await priceItems(data.items, `Heard: "${data.transcript}"`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'dictation failed');
    } finally {
      setBusy(false);
    }
  }

  async function priceItems(
    parsedItems: { name: string; quantity: number | null }[],
    firstLine: string,
  ) {
    const lines: string[] = [
      firstLine,
      `Parsed ${parsedItems.length} item${parsedItems.length === 1 ? '' : 's'}: ${parsedItems.map((i) => i.name).join(', ')}`,
    ];
    setTrace([...lines]);
    const results: ItemResult[] = [];
    for (const item of parsedItems) {
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(item.name)}`);
      if (!res.ok) throw new Error(`search ${res.status}`);
      const search = (await res.json()) as SearchResult;
      results.push({ name: item.name, quantity: item.quantity, search });
    }
    setItems(results);
    const matched = results.filter((r) => r.search.confirmed.length > 0).length;
    const needsCall = results.reduce((n, r) => n + r.search.review.length, 0);
    const payableFor = (r: ItemResult) => {
      const top = r.search.confirmed.find((o) => o.priceMatchAtFreshCo) ?? r.search.confirmed[0];
      if (!top) return 0;
      return top.priceMatchAtFreshCo ? Math.max(0, top.currentPrice - 0.01) : top.currentPrice;
    };
    const total = results.reduce((sum, r) => sum + payableFor(r), 0);
    const anyEligible = results.some((r) => r.search.confirmed.some((o) => o.priceMatchAtFreshCo));
    lines.push(
      `Matched ${matched}/${results.length} items · ${needsCall} candidate${needsCall === 1 ? '' : 's'} need your call`,
      matched
        ? anyEligible
          ? `Basket payable at FreshCo (best eligible match per item, incl. 1¢ beat): $${total.toFixed(2)} CAD`
          : `Flyer prices found, but none are price-matchable at FreshCo (outside its Ontario program) — basket at flyer prices: $${total.toFixed(2)} CAD`
        : 'No confirmed matches yet — nothing priced by guesswork',
    );
    setTrace([...lines]);
  }

  async function priceList(text: string, firstTraceLine?: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setItems([]);
    const lines: string[] = [firstTraceLine ?? `List: "${trimmed}"`, 'Parsing with Muse Spark…'];
    setTrace([...lines]);
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
      await priceItems(parsed.items, lines[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
      lines.push('Failed — check the backend is running');
      setTrace([...lines]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>MooseCart</Text>
      <Text style={styles.sub}>Powered by Meta Muse · Home store: FreshCo, Milton · prices from stored flyer offers, never AI-invented</Text>

      <Pressable
        style={({ pressed }) => [styles.mic, recording && styles.micActive, pressed && styles.pressed, busy && styles.disabled]}
        android_ripple={{ color: C.pressedLight }}
        onPress={recording ? stopAndTranscribe : startRecording}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording and transcribe' : 'Dictate my grocery list by voice'}
        accessibilityState={{ disabled: busy }}
      >
        <View style={styles.btnRow}>
          <MaterialIcons
            name={recording ? 'stop-circle' : 'mic'}
            accessible={false}
            size={20}
            color={C.onSecondary}
            style={styles.btnIcon}
          />
          <Text style={styles.micText}>
            {recording ? `Stop & transcribe (${recSeconds}s)` : 'Dictate my list'}
          </Text>
        </View>
      </Pressable>

      <Text style={styles.label} nativeID="listLabel">Grocery list</Text>
      <TextInput
        style={styles.input}
        value={listText}
        onChangeText={setListText}
        placeholder={'"milk, eggs, oranges"'}
        autoCapitalize="none"
        multiline
        accessibilityLabelledBy="listLabel"
        accessibilityLabel="Grocery list"
      />
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}
        android_ripple={{ color: C.pressedLight }}
        onPress={() => priceList(listText)}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Parse and price my list"
        accessibilityState={{ disabled: busy }}
      >
        <Text style={styles.buttonText}>{busy ? 'Working…' : 'Parse & price my list'}</Text>
      </Pressable>
      {busy && <ActivityIndicator accessibilityLabel="Working" />}

      <Pressable
        style={({ pressed }) => [styles.mic, scanning && styles.micActive, pressed && styles.pressed]}
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
        <View style={styles.btnRow}>
          <MaterialIcons
            name={scanning ? 'stop-circle' : 'qr-code-scanner'}
            accessible={false}
            size={20}
            color={C.onSecondary}
            style={styles.btnIcon}
          />
          <Text style={styles.micText}>{scanning ? 'Stop scanner' : 'Scan a barcode in store'}</Text>
        </View>
      </Pressable>
      {scanning && (
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={({ data }) => void onBarcode(data)}
        />
      )}

      {trace.length > 0 && (
        <View style={styles.trace}>
          <Text style={styles.traceTitle}>Agent</Text>
          {trace.map((line, i) => (
            <Text key={i} style={styles.traceLine}>→ {line}</Text>
          ))}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {items.map((item) => (
        <View key={item.name} style={styles.section}>
          <Text style={styles.h}>
            {item.name}
            {item.quantity ? ` × ${item.quantity}` : ''}
          </Text>
          {item.search.confirmed.slice(0, 3).map((o) => (
            <Pressable
              key={o.dealId}
              style={({ pressed }) => [styles.card, picks[item.name]?.dealId === o.dealId && styles.pickedCard, pressed && styles.cardPressed]}
              android_ripple={{ color: C.pressedDark }}
              onPress={() => setEvidence({ item: item.name, offer: o, isReview: false })}
              accessibilityRole="button"
              accessibilityLabel={`${o.name}, ${o.merchant}, $${o.currentPrice} ${o.currency}. Show flyer evidence.`}
            >
              <Text style={styles.name}>{o.name}</Text>
              <Text>
                {o.merchant} · ${o.currentPrice} {o.currency}
                {o.priceBasis.raw ? ` (${o.priceBasis.raw})` : ''}
              </Text>
              <Text style={styles.meta}>
                {(picks[item.name]?.dealId === o.dealId || (!picks[item.name] && item.search.confirmed[0]?.dealId === o.dealId))
                  ? '★ your pick · '
                  : ''}✓ confirmed match · valid to {new Date(o.validTo).toLocaleDateString()} · tap for flyer evidence
              </Text>
              <Text style={styles.meta}>
                {o.priceMatchAtFreshCo
                  ? `✓ price-matchable at FreshCo — you pay $${Math.max(0, o.currentPrice - 0.01).toFixed(2)} (1¢ beat)`
                  : '✗ not price-matchable at FreshCo (competitor outside its Ontario program)'}
              </Text>
            </Pressable>
          ))}
          {item.search.confirmed.length === 0 && (
            <Text style={styles.meta}>No confirmed offer — stays unmatched, never guessed.</Text>
          )}
          {item.search.review.slice(0, 3).map((o) => (
            <Pressable
              key={o.dealId}
              style={({ pressed }) => [styles.card, styles.reviewCard, pressed && styles.cardPressed]}
              android_ripple={{ color: C.pressedDark }}
              onPress={() => setEvidence({ item: item.name, offer: o, isReview: true })}
              accessibilityRole="button"
              accessibilityLabel={`${o.name}, ${o.merchant}, $${o.currentPrice} ${o.currency}. Review this candidate.`}
            >
              <Text style={styles.name}>{o.name}</Text>
              <Text>
                {o.merchant} · ${o.currentPrice} {o.currency}
              </Text>
              <Text style={styles.meta}>? needs your call — {o.reviewReason} · tap to review</Text>
            </Pressable>
          ))}
        </View>
      ))}

      {items.length > 0 && (
        <View style={styles.row}>
          <Pressable
            style={({ pressed }) => [styles.button, styles.rowBtn, pressed && styles.pressed]}
            android_ripple={{ color: C.pressedLight }}
            onPress={savePlan}
            accessibilityRole="button"
            accessibilityLabel="Save plan for cashier retrieval"
          >
            <Text style={styles.buttonText}>Save plan</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.mic, styles.rowBtn, pressed && styles.pressed]}
            android_ripple={{ color: C.pressedLight }}
            onPress={() => setCashierMode((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={cashierMode ? 'Hide cashier view' : 'Show cashier view'}
          >
            <Text style={styles.micText}>{cashierMode ? 'Hide cashier view' : 'Cashier view'}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.stubBtn, styles.rowBtn, pressed && styles.cardPressed]}
          android_ripple={{ color: C.pressedDark }}
          onPress={() => setStub('account')}
          accessibilityRole="button"
          accessibilityLabel="Account, preview only"
        >
          <Text>Account (preview)</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.stubBtn, styles.rowBtn, pressed && styles.cardPressed]}
          android_ripple={{ color: C.pressedDark }}
          onPress={() => setStub('subscription')}
          accessibilityRole="button"
          accessibilityLabel="Subscription, preview only"
        >
          <Text>Subscription (preview)</Text>
        </Pressable>
      </View>

      <Modal visible={stub !== null} animationType="slide" onRequestClose={() => setStub(null)}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.modal}>
          <Text style={styles.title}>{stub === 'account' ? 'Account' : 'Subscription'} — preview</Text>
          <Text>
            {stub === 'account'
              ? 'Sign-in and account management are not part of this hackathon build. No account is needed to plan, price-match, or use cashier view.'
              : 'MooseCart Pro is planned at CAD $9.99/month after the hackathon, with a verified-savings guarantee. Billing is not active in this build — every feature here is open.'}
          </Text>
          <Text style={styles.meta}>This screen is a labelled preview stub, not working commerce.</Text>
          <Pressable
            style={({ pressed }) => [styles.mic, pressed && styles.pressed]}
            android_ripple={{ color: C.pressedLight }}
            onPress={() => setStub(null)}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
          >
            <Text style={styles.micText}>Close</Text>
          </Pressable>
        </View>
        </SafeAreaView>
      </Modal>

      {cashierMode && (
        <View style={styles.section}>
          <Text style={styles.h}>At the FreshCo cashier</Text>
          {!savedPlan && <Text style={styles.meta}>No saved plan yet — price a list and tap Save plan.</Text>}
          {savedPlan?.picks.map((p) => (
            <Pressable
              key={p.item}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              android_ripple={{ color: C.pressedDark }}
              onPress={() => setEvidence({ item: p.item, offer: p.offer, isReview: false })}
              accessibilityRole="button"
              accessibilityLabel={`${p.item}: ${p.offer.name}. Show flyer evidence.`}
            >
              <Text style={styles.name}>{p.item}: {p.offer.name}</Text>
              <Text>{p.offer.merchant} · ${p.offer.currentPrice} {p.offer.currency} · tap to show flyer evidence</Text>
            </Pressable>
          ))}
          {savedPlan && (
            <Text style={styles.meta}>
              Total payable: ${savedPlan.picks.reduce((s, p) => s + (p.offer.priceMatchAtFreshCo ? Math.max(0, p.offer.currentPrice - 0.01) : p.offer.currentPrice), 0).toFixed(2)} CAD (incl. 1¢ beat on eligible matches) · saved {new Date(savedPlan.savedAt).toLocaleString()}
            </Text>
          )}
        </View>
      )}

      <Modal visible={evidence !== null} animationType="slide" onRequestClose={() => setEvidence(null)}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.title}>Flyer evidence</Text>
          {evidence && (
            <>
              <EvidenceImage key={evidence.offer.dealId} uri={evidence.offer.imageUrl} />
              <Text style={styles.name}>{evidence.offer.name}</Text>
              <Text>
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
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  container: { padding: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: '700', color: C.text },
  sub: { color: C.muted },
  label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: -8 },
  mic: { backgroundColor: C.secondary, borderRadius: 8, padding: 16, alignItems: 'center', minHeight: 56 },
  micActive: { backgroundColor: C.danger },
  micText: { color: C.onSecondary, fontSize: 16, fontWeight: '600' },
  btnRow: { flexDirection: 'row', alignItems: 'center' },
  btnIcon: { marginRight: 8 },
  pressed: { opacity: 0.75 },
  cardPressed: { backgroundColor: '#f0f0f0' },
  disabled: { opacity: 0.45 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 56,
    textAlignVertical: 'top',
    color: C.text,
  },
  button: { backgroundColor: C.primary, borderRadius: 8, padding: 16, alignItems: 'center', minHeight: 56 },
  buttonText: { color: C.onPrimary, fontSize: 16, fontWeight: '600' },
  trace: { backgroundColor: C.traceBg, borderRadius: 8, padding: 12, gap: 4 },
  traceTitle: { fontWeight: '700', color: C.text },
  traceLine: { color: C.traceText },
  error: { color: C.danger },
  section: { gap: 8 },
  h: { fontSize: 18, fontWeight: '700', marginTop: 8, textTransform: 'capitalize', color: C.text },
  card: { borderWidth: 1, borderColor: C.cardBorder, borderRadius: 8, padding: 12, gap: 4 },
  pickedCard: { borderColor: C.primary, borderWidth: 2 },
  reviewCard: { borderColor: C.warningBorder, backgroundColor: C.warningBg },
  row: { flexDirection: 'row', gap: 8 },
  stubBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, alignItems: 'center', minHeight: 48 },
  rowBtn: { flex: 1 },
  modal: { padding: 16, gap: 12 },
  evidenceImg: { width: '100%', height: 320, backgroundColor: C.imageBg, borderRadius: 8 },
  evidenceFallback: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  camera: { height: 320, borderRadius: 8, overflow: 'hidden' },
  name: { fontWeight: '600', color: C.text },
  meta: { color: C.muted, fontSize: 13 },
});
