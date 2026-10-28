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
  pricePerLb: number | null;
  validTo: string;
  imageUrl: string;
  reviewReason?: string;
};

type SearchResult = {
  query: string;
  dataMode: string;
  confirmed: Offer[];
  review: Offer[];
  excludedCount: number;
};

export default function App() {
  const [item, setItem] = useState('orange');
  const [trace, setTrace] = useState<string[]>([]);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const q = item.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setTrace([`Heard: "${q}"`, 'Searching stored flyer offers…']);
    try {
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`backend ${res.status}`);
      const data = (await res.json()) as SearchResult;
      setResult(data);
      setTrace([
        `Heard: "${q}"`,
        `Matched ${data.confirmed.length} confirmed · ${data.review.length} need your call · ${data.excludedCount} excluded as noise/expired`,
        data.confirmed.length
          ? `Best confirmed: ${data.confirmed[0].name} @ ${data.confirmed[0].merchant} — $${data.confirmed[0].currentPrice}`
          : 'No confirmed match — nothing priced by guesswork',
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'search failed');
      setTrace([`Heard: "${q}"`, 'Search failed — check the backend is running']);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>AI Price Matcher</Text>
      <Text style={styles.sub}>Home store: FreshCo (price match) · data: stored flyer offers</Text>

      <TextInput
        style={styles.input}
        value={item}
        onChangeText={setItem}
        placeholder="Type a grocery item (voice comes next)"
        autoCapitalize="none"
      />
      <Pressable style={styles.button} onPress={search} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Searching…' : 'Find prices'}</Text>
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

      {result && (
        <View style={styles.section}>
          <Text style={styles.h}>Confirmed matches</Text>
          {result.confirmed.map((o) => (
            <View key={o.dealId} style={styles.card}>
              <Text style={styles.name}>{o.name}</Text>
              <Text>{o.merchant} · ${o.currentPrice} {o.currency}{o.priceBasis.raw ? ` (${o.priceBasis.raw})` : ''}</Text>
              <Text style={styles.meta}>Valid to {new Date(o.validTo).toLocaleDateString()}</Text>
            </View>
          ))}
          {result.confirmed.length === 0 && <Text style={styles.meta}>None — item stays unmatched.</Text>}

          <Text style={styles.h}>Needs your call</Text>
          {result.review.map((o) => (
            <View key={o.dealId} style={styles.card}>
              <Text style={styles.name}>{o.name}</Text>
              <Text>{o.merchant} · ${o.currentPrice} {o.currency}</Text>
              <Text style={styles.meta}>{o.reviewReason}</Text>
            </View>
          ))}
          {result.review.length === 0 && <Text style={styles.meta}>Nothing ambiguous.</Text>}
        </View>
      )}
      <StatusBar style="auto" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60, gap: 12 },
  title: { fontSize: 26, fontWeight: '700' },
  sub: { color: '#555' },
  input: { borderWidth: 1, borderColor: '#bbb', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#0a7d33', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  trace: { backgroundColor: '#eef6f0', borderRadius: 8, padding: 12, gap: 4 },
  traceTitle: { fontWeight: '700' },
  traceLine: { color: '#234' },
  error: { color: '#b00020' },
  section: { gap: 8 },
  h: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  card: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, gap: 2 },
  name: { fontWeight: '600' },
  meta: { color: '#666', fontSize: 12 },
});
