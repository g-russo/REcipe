import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { recognizeFood } from '../../services/food-recog-api'; // ✅ Changed from classifyImageAsync

export default function ResultScreen() {
  const { data, uri } = useLocalSearchParams();

  const initial = useMemo(() => {
    try { return data ? JSON.parse(data) : null; } catch { return null; }
  }, [data]);

  const [result, setResult] = useState(initial);
  const [loading, setLoading] = useState(false);

  // Image sizing for overlay
  const [origSize, setOrigSize] = useState(null);      // { w, h }
  const [layoutW, setLayoutW] = useState(0);           // container width

  useEffect(() => {
    // If not passed precomputed data, analyze from uri
    if (!result && uri) {
      (async () => {
        setLoading(true);
        try {
          const res = await recognizeFood(uri); // ✅ Changed from classifyImageAsync
          setResult(res);
        } catch (e) {
          console.error('Recognize error:', e);
          setResult({ detections: [], note: 'frontend error' });
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [result, uri]);

  useEffect(() => {
    if (!uri) return;
    Image.getSize(
      uri,
      (w, h) => setOrigSize({ w, h }),
      () => setOrigSize(null)
    );
  }, [uri]);

  // Normalize fields from various backend shapes
  const detections = useMemo(() => {
    const arr = result?.detections || result?.detector_detections || [];
    return Array.isArray(arr) ? arr : [];
  }, [result]);

  const food101TopK = useMemo(() => {
    const arr = result?.main_topk || result?.food101_topk || [];
    return Array.isArray(arr) ? arr : [];
  }, [result]);

  const filipinoTopK = useMemo(() => {
    const arr = result?.fil_topk || result?.filipino_topk || [];
    return Array.isArray(arr) ? arr : [];
  }, [result]);

  const hasDetections = detections.length > 0;
  const pct = (v) => (typeof v === 'number' ? (v * 100).toFixed(1) : '?');

  // Compute displayed image height to maintain aspect ratio
  const displayH = useMemo(() => {
    if (!origSize || !layoutW) return 0;
    const { w, h } = origSize;
    return Math.max(1, Math.round((layoutW * h) / w));
  }, [origSize, layoutW]);

  // Scale helper supports both absolute px and normalized [0..1]
  const scaleBox = (b) => {
    if (!origSize || !displayH || !layoutW) return null;
    const { w, h } = origSize;
    const isNormalized = Math.max(b.x2 ?? 0, b.y2 ?? 0) <= 1.5;
    const x1 = (isNormalized ? b.x1 * w : b.x1) || 0;
    const y1 = (isNormalized ? b.y1 * h : b.y1) || 0;
    const x2 = (isNormalized ? b.x2 * w : b.x2) || 0;
    const y2 = (isNormalized ? b.y2 * h : b.y2) || 0;
    const sx = layoutW / w;
    const sy = displayH / h;
    return {
      left: x1 * sx,
      top: y1 * sy,
      width: Math.max(1, (x2 - x1) * sx),
      height: Math.max(1, (y2 - y1) * sy),
    };
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      {/* Image + overlays */}
      {uri ? (
        <View
          onLayout={(e) => setLayoutW(e.nativeEvent.layout.width)}
          style={{ width: '100%', backgroundColor: '#111', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}
        >
          {/* Displayed image */}
          {!!displayH && (
            <Image source={{ uri }} style={{ width: '100%', height: displayH, resizeMode: 'contain' }} />
          )}
          {/* Overlays for detector (best.pt) */}
          {!!displayH && hasDetections && (
            <View style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: displayH }}>
              {detections.map((d, i) => {
                const box = scaleBox(d);
                if (!box) return null;
                const label = d.label || d.class_name || 'object';
                return (
                  <View key={i} style={[styles.box, box]}>
                    <Text style={styles.boxLabel}>
                      {label} {typeof d.confidence === 'number' ? `${pct(d.confidence)}%` : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ) : null}

      {loading && <ActivityIndicator size="large" />}

      {/* Summary */}
      {!loading && result && (
        <View>
          <Text style={styles.title}>Recognition Results</Text>
          <Text style={styles.meta}>
            Model: {result.model ?? '—'} • Device: {result.device ?? '—'}
            {typeof result?.elapsed_ms === 'number' ? ` • Time: ${result.elapsed_ms.toFixed(0)} ms` : ''}
          </Text>

          {/* Global class (if backend provides one) */}
          {result?.global_class && (
            <Text style={styles.section}>
              Global: {result.global_class}
              {typeof result.global_conf === 'number' ? ` (${pct(result.global_conf)}%)` : ''}
              {result.global_class_source ? ` [${result.global_class_source}]` : ''}
            </Text>
          )}

          {/* Food101 top-k */}
          {food101TopK.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.section}>Food101 top-{food101TopK.length}</Text>
              {food101TopK.map((it, i) => (
                <View key={`f101-${i}`} style={styles.row}>
                  <Text style={styles.label}>{i + 1}. {it.label}</Text>
                  <Text style={styles.conf}>{pct(it.conf)}%</Text>
                </View>
              ))}
            </View>
          )}

          {/* Filipino top-k */}
          {filipinoTopK.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.section}>Filipino top-{filipinoTopK.length}</Text>
              {filipinoTopK.map((it, i) => (
                <View key={`fil-${i}`} style={styles.row}>
                  <Text style={styles.label}>{i + 1}. {it.label}</Text>
                  <Text style={styles.conf}>{pct(it.conf)}%</Text>
                </View>
              ))}
            </View>
          )}

          {/* Detector detections (best.pt) */}
          <View style={{ marginTop: 12 }}>
            <Text style={styles.section}>
              Detections (best.pt) {hasDetections ? `• ${detections.length}` : '• 0'}
            </Text>
            {hasDetections ? (
              detections.map((d, i) => (
                <View key={`det-${i}`} style={styles.row}>
                  <Text style={styles.label}>
                    {i + 1}. {d.label || d.class_name || 'object'}
                  </Text>
                  <Text style={styles.conf}>
                    {typeof d.confidence === 'number' ? `${pct(d.confidence)}%` : ''}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: 'orange', marginTop: 6 }}>
                No detections returned by detector.
              </Text>
            )}
          </View>

          {/* Note + Raw (short) */}
          {result?.note && <Text style={styles.note}>Note: {result.note}</Text>}
          <Text style={styles.raw}>RAW: {JSON.stringify(result).slice(0, 1200)}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  meta: { fontSize: 12, color: '#666' },
  section: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  label: { fontSize: 16, color: '#111' },
  conf: { fontSize: 16, color: '#333' },
  note: { marginTop: 8, fontSize: 12, color: '#888' },
  raw: { marginTop: 16, fontSize: 12, color: '#666' },

  // bounding boxes
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#22c55e',
    backgroundColor: 'transparent',
  },
  boxLabel: {
    position: 'absolute',
    left: 0,
    top: -20,
    backgroundColor: '#22c55e',
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
});