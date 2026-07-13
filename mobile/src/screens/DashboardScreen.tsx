import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, RefreshControl, ScrollView,
  StyleSheet, Text, View, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gateway, Session } from '../services/gateway';
import { loadKeypair } from '../services/keystore';
import ScoreRing from '../components/ScoreRing';
import PressableScale from '../components/PressableScale';
import FadeSlideIn from '../components/FadeSlideIn';
import { C, radius, shadow } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

const POLL_MS    = 30_000;
const SESSION_KEY = 'active_session_id';

// ── Pulse dot ────────────────────────────────────────────────────────────────

function PulseDot({ active }: { active: boolean }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.25, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);
  return <Animated.View style={[styles.dot, { backgroundColor: active ? C.green : C.textDim, opacity: active ? anim : 1 }]} />;
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, icon }: { label: string; value: string; sub?: string; accent?: string; icon: IconName }) {
  const tint = accent ?? C.textSub;
  return (
    <View style={[styles.statCard, accent && { borderColor: accent + '33' }]}>
      <View style={styles.statHead}>
        <View style={[styles.statIcon, { backgroundColor: tint + '1A' }]}>
          <Ionicons name={icon} size={13} color={tint} />
        </View>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, accent && { color: accent }]}>{value}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ w, h, style }: { w: number | string; h: number; style?: object }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[{ width: w as any, height: h, backgroundColor: C.bgCard2, borderRadius: 8, opacity: anim }, style]} />;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [session, setSession]     = useState<Session | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mnemonic, setMnemonic]   = useState<string | null>(null);
  const [lastAt, setLastAt]       = useState<Date | null>(null);

  useEffect(() => {
    loadKeypair().then(kp => { if (kp) setMnemonic(kp.mnemonic); });
  }, []);

  const refresh = useCallback(async (manual = false) => {
    if (!mnemonic) { setLoading(false); return; }
    if (manual) setRefreshing(true);
    const id = await AsyncStorage.getItem(SESSION_KEY);
    if (!id) { setLoading(false); setRefreshing(false); return; }
    try {
      const s = await gateway.getSession(id, mnemonic);
      setSession(s);
      setLastAt(new Date());
    } catch { setSession(null); }
    finally { setLoading(false); setRefreshing(false); }
  }, [mnemonic]);

  useEffect(() => { refresh(); const t = setInterval(refresh, POLL_MS); return () => clearInterval(t); }, [refresh]);

  const stop = () => {
    if (!session || !mnemonic) return;
    Alert.alert('Stop Mining?', 'Remaining time is non-refundable.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: async () => {
        await gateway.stopSession(session.session_id, mnemonic);
        await AsyncStorage.removeItem(SESSION_KEY);
        setSession(null);
      }},
    ]);
  };

  // ── Loading skeleton
  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 24 }]}>
        <Skeleton w="60%" h={20} style={{ marginHorizontal: 24, marginBottom: 12 }} />
        <Skeleton w="40%" h={14} style={{ marginHorizontal: 24, marginBottom: 40 }} />
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <Skeleton w={130} h={130} style={{ borderRadius: 65 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 24 }}>
          <Skeleton w="47%" h={90} style={{ borderRadius: 16 }} />
          <Skeleton w="47%" h={90} style={{ borderRadius: 16 }} />
        </View>
      </View>
    );
  }

  // ── Empty state
  if (!session) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <FadeSlideIn style={{ alignItems: 'center' }}>
          <View style={styles.emptyIcon}><Ionicons name="hardware-chip-outline" size={42} color={C.purpleL} /></View>
          <Text style={styles.emptyTitle}>Not mining yet</Text>
          <Text style={styles.emptySub}>Launch a cloud miner on Akash Network. Your node earns TAO while you sleep.</Text>
          <PressableScale style={styles.emptyBtn} onPress={() => navigation.navigate('Start Mining')}>
            <Text style={styles.emptyBtnText}>Start Mining</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </PressableScale>
          <View style={styles.emptyFeatures}>
            {['No VPS needed', 'Pay per hour with USDC', 'Key stays on device'].map(f => (
              <View key={f} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={15} color={C.purple} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        </FadeSlideIn>
      </View>
    );
  }

  // ── Active session
  const stats = (session.stats ?? {}) as Record<string, number | string>;
  const score = stats.avg_score != null ? Number(stats.avg_score) : null;
  const proof = stats.proof_rate != null ? Number(stats.proof_rate) : null;
  const secs  = session.remaining_seconds;
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  const timeLeft = h > 0 ? `${h}h ${m}m` : `${m}m`;
  const isActive = session.status === 'active';
  const updated  = lastAt ? lastAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh(true)} tintColor={C.purple} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Mining Dashboard</Text>
          {updated ? <Text style={styles.headerSub}>Updated {updated}</Text> : null}
        </View>
        <View style={styles.statusPill}>
          <PulseDot active={isActive} />
          <Text style={[styles.statusText, { color: isActive ? C.green : C.textSub }]}>
            {isActive ? 'LIVE' : session.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Score + time */}
      <FadeSlideIn delay={60}>
        <View style={styles.heroCard}>
          <View style={{ alignItems: 'center' }}>
            {score !== null
              ? <ScoreRing score={score} size={140} label="Avg Score" />
              : <View style={styles.scoreEmpty}><Text style={styles.scoreEmptyText}>—</Text></View>}
          </View>
          <View style={styles.heroRight}>
            <View style={styles.timeBadge}>
              <Text style={styles.timeValue}>{timeLeft}</Text>
              <Text style={styles.timeLabel}>remaining</Text>
            </View>
            <Text style={styles.paidText}>Paid ${session.amount_paid_usd.toFixed(2)} USDC</Text>
            {proof !== null && (
              <View style={styles.proofRow}>
                <View style={[styles.proofBar, { backgroundColor: C.border }]}>
                  <View style={[styles.proofFill, { width: `${proof * 100}%` as any, backgroundColor: proof > 0.8 ? C.purple : proof > 0.5 ? C.amber : C.red }]} />
                </View>
                <Text style={styles.proofText}>{(proof * 100).toFixed(0)}% proof</Text>
              </View>
            )}
          </View>
        </View>
      </FadeSlideIn>

      {/* Stats grid */}
      <FadeSlideIn delay={120}>
        <View style={styles.grid}>
          <StatCard icon="layers-outline"      label="Vectors" value={String(stats.vectors ?? '—')} sub="stored" accent={C.purpleL} />
          <StatCard icon="flash-outline"       label="Latency" value={stats.p50_latency_ms != null ? `${stats.p50_latency_ms}ms` : '—'} sub="P50" accent={Number(stats.p50_latency_ms) < 100 ? C.green : C.amber} />
          <StatCard icon="search-outline"      label="Queries" value={String(stats.queries_today ?? '—')} sub="today" />
          <StatCard icon="cube-outline"        label="Block" value={stats.block ? `#${String(stats.block).slice(-5)}` : '—'} sub="current" />
        </View>
      </FadeSlideIn>

      {/* Node endpoint */}
      {session.node_endpoint && (
        <FadeSlideIn delay={180}>
          <View style={styles.nodeCard}>
            <View style={styles.nodeLabelRow}>
              <Ionicons name="globe-outline" size={13} color={C.textSub} />
              <Text style={styles.nodeLabel}>Node Endpoint</Text>
            </View>
            <Text style={styles.nodeValue} selectable numberOfLines={1} ellipsizeMode="middle">
              {session.node_endpoint}
            </Text>
          </View>
        </FadeSlideIn>
      )}

      {/* Stop */}
      <PressableScale style={styles.stopBtn} onPress={stop} dim={false}>
        <Ionicons name="stop-circle-outline" size={18} color={C.red} />
        <Text style={styles.stopText}>Stop Mining</Text>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:         { flex: 1, backgroundColor: C.bg },
  center:         { alignItems: 'center', justifyContent: 'center', padding: 32 },
  // Header
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 24, marginBottom: 20 },
  headerLabel:    { color: C.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  headerSub:      { color: C.textDim, fontSize: 11, marginTop: 3 },
  statusPill:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bgCard, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.border },
  statusText:     { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  dot:            { width: 7, height: 7, borderRadius: 4 },
  // Hero card
  heroCard:       { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 16, backgroundColor: C.bgCard, borderRadius: radius.xl, padding: 24, borderWidth: 1, borderColor: C.border, gap: 20, ...shadow.card },
  heroRight:      { flex: 1, gap: 12 },
  timeBadge:      { backgroundColor: C.purpleD, borderRadius: radius.md, padding: 12 },
  timeValue:      { color: C.purpleL, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  timeLabel:      { color: C.purple, fontSize: 11, fontWeight: '500', marginTop: 1 },
  paidText:       { color: C.textSub, fontSize: 12 },
  proofRow:       { gap: 4 },
  proofBar:       { height: 4, borderRadius: 2, overflow: 'hidden' },
  proofFill:      { height: 4, borderRadius: 2 },
  proofText:      { color: C.textSub, fontSize: 11 },
  scoreEmpty:     { width: 140, height: 140, borderRadius: 70, backgroundColor: C.bgCard2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  scoreEmptyText: { color: C.textDim, fontSize: 28, fontWeight: '800' },
  // Stats
  grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  statCard:       { width: '47.5%', backgroundColor: C.bgCard, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: C.border, ...shadow.card },
  statHead:       { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  statIcon:       { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  statLabel:      { color: C.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  statValue:      { color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 },
  statSub:        { color: C.textDim, fontSize: 11 },
  // Node
  nodeCard:       { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.bgCard, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: C.border },
  nodeLabelRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  nodeLabel:      { color: C.textSub, fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  nodeValue:      { color: C.textMono, fontSize: 12, fontFamily: 'monospace' },
  // Stop
  stopBtn:        { flexDirection: 'row', gap: 8, marginHorizontal: 16, backgroundColor: C.redD, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.red + '44' },
  stopText:       { color: C.red, fontSize: 15, fontWeight: '700' },
  // Empty
  emptyIcon:      { width: 96, height: 96, borderRadius: 48, backgroundColor: C.purpleD, alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 1, borderColor: C.borderAct, ...shadow.glow },
  emptyTitle:     { color: C.text, fontSize: 24, fontWeight: '800', marginBottom: 10, letterSpacing: -0.4 },
  emptySub:       { color: C.textSub, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32, maxWidth: 280 },
  emptyBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.purple, borderRadius: radius.full, paddingVertical: 16, paddingHorizontal: 36, marginBottom: 40, ...shadow.glow },
  emptyBtnText:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  emptyFeatures:  { gap: 10, alignSelf: 'stretch', paddingHorizontal: 20 },
  featureRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText:    { color: C.textSub, fontSize: 14 },
});
