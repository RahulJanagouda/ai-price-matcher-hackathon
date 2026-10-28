import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';

// Backend base URL. On a physical Pixel, set EXPO_PUBLIC_API_URL to the
// dev machine's LAN address, e.g. http://192.168.1.20:8787
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8787';

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

export default function App() {
  const [listText, setListText] = useState('');
  const [trace, setTrace] = useState<string[]>([]);
  const [items, setItems] = useState<ItemResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const uri = recorder.uri;
      if (!uri) throw new Error('no recording captured');
      setBusy(true);
      setTrace(['Uploading your voice list…']);
      const form = new FormData();
      form.append('audio', { uri, name: 'list.m4a', type: 'audio/m4a' } as unknown as Blob);
      const res = await fetch(`${API_URL}/transcribe-file`, { method: 'POST', body: form });
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
            <View key={o.dealId} style={styles.card}>
              <Text style={styles.name}>{o.name}</Text>
              <Text>
                {o.merchant} · ${o.currentPrice} {o.currency}
                {o.priceBasis.raw ? ` (${o.priceBasis.raw})` : ''}
              </Text>
              <Text style={styles.meta}>✓ confirmed match · valid to {new Date(o.validTo).toLocaleDateString()}</Text>
            </View>
          ))}
          {item.search.confirmed.length === 0 && (
            <Text style={styles.meta}>No confirmed offer — stays unmatched, never guessed.</Text>
          )}
          {item.search.review.slice(0, 3).map((o) => (
            <View key={o.dealId} style={[styles.card, styles.reviewCard]}>
              <Text style={styles.name}>{o.name}</Text>
              <Text>
                {o.merchant} · ${o.currentPrice} {o.currency}
              </Text>
              <Text style={styles.meta}>? needs your call — {o.reviewReason}</Text>
            </View>
          ))}
        </View>
      ))}
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
  reviewCard: { borderColor: '#e0a800', backgroundColor: '#fff8e1' },
  name: { fontWeight: '600' },
  meta: { color: '#666', fontSize: 12 },
});
