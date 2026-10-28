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
      setTrace(['Uploading your voice list…']);
      const bytes = await new File(uri).bytes();
      const res = await fetch(`${API_URL}/transcribe-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'audio/m4a' },
        body: bytes as unknown as BodyInit,
      });
      if (!res.ok) throw new Error(`transcribe ${res.status}`);
      const data = (await res.json()) as { text: string };
      setListText(data.text);
      await priceList(data.text, `Heard: "${data.text}"`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'transcription failed');
    } finally {
      setBusy(false);
    }
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
      lines.push(`Parsed ${parsed.items.length} item${parsed.items.length === 1 ? '' : 's'}: ${parsed.items.map((i) => i.name).join(', ')}`);
      setTrace([...lines]);

      const results: ItemResult[] = [];
      for (const item of parsed.items) {
        const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(item.name)}`);
        if (!res.ok) throw new Error(`search ${res.status}`);
        const search = (await res.json()) as SearchResult;
        results.push({ name: item.name, quantity: item.quantity, search });
      }
      setItems(results);
      const matched = results.filter((r) => r.search.confirmed.length > 0).length;
      const needsCall = results.reduce((n, r) => n + r.search.review.length, 0);
      const total = results.reduce(
        (sum, r) => sum + (r.search.confirmed[0]?.currentPrice ?? 0),
        0,
      );
      lines.push(
        `Matched ${matched}/${results.length} items · ${needsCall} candidate${needsCall === 1 ? '' : 's'} need your call`,
        matched
          ? `Basket at matched prices (top confirmed offer per item): $${total.toFixed(2)} CAD at FreshCo`
          : 'No confirmed matches yet — nothing priced by guesswork',
      );
      setTrace([...lines]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
      lines.push('Failed — check the backend is running');
      setTrace([...lines]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>AI Price Matcher</Text>
      <Text style={styles.sub}>Home store: FreshCo, Milton · prices from stored flyer offers, never AI-invented</Text>

      <Pressable
        style={[styles.mic, recording && styles.micActive]}
        onPress={recording ? stopAndTranscribe : startRecording}
        disabled={busy}
      >
        <Text style={styles.micText}>{recording ? '■ Stop & transcribe' : '🎙 Dictate my list'}</Text>
      </Pressable>

      <TextInput
        style={styles.input}
        value={listText}
        onChangeText={setListText}
        placeholder={'…or type it: "milk, eggs, oranges"'}
        autoCapitalize="none"
        multiline
      />
      <Pressable style={styles.button} onPress={() => priceList(listText)} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Working…' : 'Parse & price my list'}</Text>
      </Pressable>
      {busy && <ActivityIndicator />}

      <Pressable
        style={[styles.mic, scanning && styles.micActive]}
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
      >
        <Text style={styles.micText}>{scanning ? '■ Stop scanner' : '📷 Scan a barcode in store'}</Text>
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
              style={[styles.card, picks[item.name]?.dealId === o.dealId && styles.pickedCard]}
              onPress={() => setEvidence({ item: item.name, offer: o, isReview: false })}
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
            </Pressable>
          ))}
          {item.search.confirmed.length === 0 && (
            <Text style={styles.meta}>No confirmed offer — stays unmatched, never guessed.</Text>
          )}
          {item.search.review.slice(0, 3).map((o) => (
            <Pressable
              key={o.dealId}
              style={[styles.card, styles.reviewCard]}
              onPress={() => setEvidence({ item: item.name, offer: o, isReview: true })}
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
          <Pressable style={[styles.button, styles.rowBtn]} onPress={savePlan}>
            <Text style={styles.buttonText}>Save plan</Text>
          </Pressable>
          <Pressable style={[styles.mic, styles.rowBtn]} onPress={() => setCashierMode((v) => !v)}>
            <Text style={styles.micText}>{cashierMode ? 'Hide cashier view' : 'Cashier view'}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.row}>
        <Pressable style={[styles.stubBtn, styles.rowBtn]} onPress={() => setStub('account')}>
          <Text>Account (preview)</Text>
        </Pressable>
        <Pressable style={[styles.stubBtn, styles.rowBtn]} onPress={() => setStub('subscription')}>
          <Text>Subscription (preview)</Text>
        </Pressable>
      </View>

      <Modal visible={stub !== null} animationType="slide" onRequestClose={() => setStub(null)}>
        <View style={styles.modal}>
          <Text style={styles.title}>{stub === 'account' ? 'Account' : 'Subscription'} — preview</Text>
          <Text>
            {stub === 'account'
              ? 'Sign-in and account management are not part of this hackathon build. No account is needed to plan, price-match, or use cashier view.'
              : 'AI Price Matcher Pro is planned at CAD $9.99/month after the hackathon, with a verified-savings guarantee. Billing is not active in this build — every feature here is open.'}
          </Text>
          <Text style={styles.meta}>This screen is a labelled preview stub, not working commerce.</Text>
          <Pressable style={styles.mic} onPress={() => setStub(null)}>
            <Text style={styles.micText}>Close</Text>
          </Pressable>
        </View>
      </Modal>

      {cashierMode && (
        <View style={styles.section}>
          <Text style={styles.h}>At the FreshCo cashier</Text>
          {!savedPlan && <Text style={styles.meta}>No saved plan yet — price a list and tap Save plan.</Text>}
          {savedPlan?.picks.map((p) => (
            <Pressable
              key={p.item}
              style={styles.card}
              onPress={() => setEvidence({ item: p.item, offer: p.offer, isReview: false })}
            >
              <Text style={styles.name}>{p.item}: {p.offer.name}</Text>
              <Text>{p.offer.merchant} · ${p.offer.currentPrice} {p.offer.currency} · tap to show flyer evidence</Text>
            </Pressable>
          ))}
          {savedPlan && (
            <Text style={styles.meta}>
              Total payable: ${savedPlan.picks.reduce((s, p) => s + p.offer.currentPrice, 0).toFixed(2)} CAD · saved {new Date(savedPlan.savedAt).toLocaleString()}
            </Text>
          )}
        </View>
      )}

      <Modal visible={evidence !== null} animationType="slide" onRequestClose={() => setEvidence(null)}>
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.title}>Flyer evidence</Text>
          {evidence && (
            <>
              <Image source={{ uri: evidence.offer.imageUrl }} style={styles.evidenceImg} resizeMode="contain" />
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
                  style={styles.button}
                  onPress={() => {
                    setPicks((prev) => ({ ...prev, [evidence.item]: evidence.offer }));
                    setEvidence(null);
                  }}
                >
                  <Text style={styles.buttonText}>Use this one for {evidence.item}</Text>
                </Pressable>
              )}
              <Pressable style={styles.mic} onPress={() => setEvidence(null)}>
                <Text style={styles.micText}>Close</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </Modal>
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60, gap: 12 },
  title: { fontSize: 26, fontWeight: '700' },
  sub: { color: '#555' },
  mic: { backgroundColor: '#123c8c', borderRadius: 8, padding: 14, alignItems: 'center' },
  micActive: { backgroundColor: '#b00020' },
  micText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  button: { backgroundColor: '#0a7d33', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  trace: { backgroundColor: '#eef6f0', borderRadius: 8, padding: 12, gap: 4 },
  traceTitle: { fontWeight: '700' },
  traceLine: { color: '#234' },
  error: { color: '#b00020' },
  section: { gap: 8 },
  h: { fontSize: 18, fontWeight: '700', marginTop: 8, textTransform: 'capitalize' },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, gap: 2 },
  pickedCard: { borderColor: '#0a7d33', borderWidth: 2 },
  reviewCard: { borderColor: '#e0a800', backgroundColor: '#fff8e1' },
  row: { flexDirection: 'row', gap: 8 },
  stubBtn: { borderWidth: 1, borderColor: '#bbb', borderRadius: 8, padding: 12, alignItems: 'center' },
  rowBtn: { flex: 1 },
  modal: { padding: 20, paddingTop: 60, gap: 12 },
  evidenceImg: { width: '100%', height: 320, backgroundColor: '#f4f4f4', borderRadius: 8 },
  camera: { height: 320, borderRadius: 8, overflow: 'hidden' },
  name: { fontWeight: '600' },
  meta: { color: '#666', fontSize: 12 },
});
