import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gateway, Tier } from '../services/gateway';
import { loadKeypair } from '../services/keystore';
import PressableScale from '../components/PressableScale';
import { C, radius, shadow } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

const SESSION_KEY = 'active_session_id';
const STEPS = ['Tier', 'Duration', 'Confirm'];
const DURATIONS = [{ label: '1 hour', hours: 1 }, { label: '6 hours', hours: 6 }, { label: '24 hours', hours: 24 }, { label: '7 days', hours: 168 }];
const TIER_META: Record<string, { icon: IconName; tagline: string; accent: string }> = {
  lite:     { icon: 'leaf',  tagline: 'Light tasks & testing', accent: C.cyan },
  standard: { icon: 'flash', tagline: 'Best value for miners', accent: C.purple },
  pro:      { icon: 'rocket', tagline: 'Maximum performance',  accent: C.amber },
};

function StepIndicator({ current }: { current: number }) {
  return (
    <View style={si.row}>
      {STEPS.map((s, i) => {
        const done    = i < current;
        const active  = i === current;
        return (
          <React.Fragment key={s}>
            <View style={si.step}>
              <View style={[si.circle, done && si.done, active && si.active]}>
                {done
                  ? <Ionicons name="checkmark" size={15} color={C.purpleL} />
                  : <Text style={[si.num, active && si.numActive]}>{i + 1}</Text>}
              </View>
              <Text style={[si.label, active && si.labelActive]}>{s}</Text>
            </View>
            {i < STEPS.length - 1 && <View style={[si.line, done && si.lineDone]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 32 },
  step:       { alignItems: 'center', gap: 4 },
  circle:     { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bgCard2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  done:       { backgroundColor: C.purpleD, borderColor: C.purple },
  active:     { backgroundColor: C.purple, borderColor: C.purple },
  num:        { color: C.textDim, fontSize: 13, fontWeight: '700' },
  numActive:  { color: '#fff' },
  label:      { color: C.textDim, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  labelActive:{ color: C.purpleL },
  line:       { flex: 1, height: 1, backgroundColor: C.border, marginHorizontal: 4, marginBottom: 16 },
  lineDone:   { backgroundColor: C.purple },
});

export default function StartMiningScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [step, setStep]       = useState(0);
  const [tiers, setTiers]     = useState<Tier[]>([]);
  const [selTier, setSelTier] = useState('standard');
  const [selHours, setSelHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    gateway.getTiers()
      .then(t => { setTiers(t); setFetching(false); })
      .catch(() => setFetching(false));
  }, []);

  const animateTo = (nextStep: number) => {
    Animated.timing(slideAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      slideAnim.setValue(0);
    });
  };

  const activeTier = tiers.find(t => t.tier === selTier);
  const totalUSD   = activeTier ? (activeTier.price_akt_per_hour * selHours * 2).toFixed(2) : '0.00';

  const launch = async () => {
    const kp = await loadKeypair();
    if (!kp) { Alert.alert('No Wallet', 'Create a wallet first.'); return; }
    const existing = await AsyncStorage.getItem(SESSION_KEY);
    if (existing) { Alert.alert('Active Session', 'Stop the current session before starting a new one.'); return; }
    setLoading(true);
    try {
      const s = await gateway.startSession({ tier: selTier, duration_hours: selHours, mnemonic: kp.mnemonic });
      await AsyncStorage.setItem(SESSION_KEY, s.session_id);
      Alert.alert('Mining Started! ⛏', 'Your node is provisioning on Akash Network. Ready in ~3 minutes.', [
        { text: 'View Dashboard', onPress: () => navigation.navigate('Dashboard') },
      ]);
      setStep(0);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.error ?? e?.message ?? 'Unknown error');
    } finally { setLoading(false); }
  };

  if (fetching) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.purple} />
        <Text style={styles.loadingText}>Loading compute tiers…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20 }]}>
      <View style={styles.topHeader}>
        <Text style={styles.title}>Launch Node</Text>
        <Text style={styles.subtitle}>Deploy a miner on Akash · pay with USDC</Text>
      </View>
      <StepIndicator current={step} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <Animated.View style={{ opacity: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>

          {/* Step 0 — Tier */}
          {step === 0 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepHeading}>Choose compute tier</Text>
              {tiers.map(tier => {
                const meta    = TIER_META[tier.tier] ?? { icon: 'cog' as IconName, tagline: '', accent: C.purple };
                const active  = selTier === tier.tier;
                return (
                  <PressableScale
                    key={tier.tier}
                    style={[styles.tierCard, active && { borderColor: meta.accent, backgroundColor: meta.accent + '12' }]}
                    onPress={() => setSelTier(tier.tier)}
                    scaleTo={0.98}
                    dim={false}
                  >
                    <View style={[styles.tierIconWrap, { backgroundColor: meta.accent + '22' }]}>
                      <Ionicons name={meta.icon} size={24} color={meta.accent} />
                    </View>
                    <View style={styles.tierInfo}>
                      <Text style={styles.tierName}>{tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1)}</Text>
                      <Text style={styles.tierSpec}>{tier.cpu_vcpu} vCPU · {tier.memory_gb} GB · {tier.storage_gb} GB disk</Text>
                      <Text style={[styles.tierTagline, { color: meta.accent }]}>{meta.tagline}</Text>
                    </View>
                    <View style={styles.tierPriceWrap}>
                      <Text style={[styles.tierPrice, active && { color: meta.accent }]}>
                        {tier.price_akt_per_hour} AKT
                      </Text>
                      <Text style={styles.tierPriceSub}>/ hour</Text>
                    </View>
                    {active && <View style={[styles.activeCheck, { backgroundColor: meta.accent }]}><Ionicons name="checkmark" size={13} color="#fff" /></View>}
                  </PressableScale>
                );
              })}
              <PressableScale style={styles.nextBtn} onPress={() => animateTo(1)}>
                <Text style={styles.nextBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </PressableScale>
            </View>
          )}

          {/* Step 1 — Duration */}
          {step === 1 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepHeading}>Choose duration</Text>
              <View style={styles.durationGrid}>
                {DURATIONS.map(d => {
                  const active = selHours === d.hours;
                  const usd    = activeTier ? (activeTier.price_akt_per_hour * d.hours * 2).toFixed(2) : '—';
                  return (
                    <PressableScale
                      key={d.hours}
                      style={[styles.durCard, active && styles.durCardActive]}
                      onPress={() => setSelHours(d.hours)}
                      scaleTo={0.97}
                      dim={false}
                    >
                      <Text style={[styles.durLabel, active && styles.durLabelActive]}>{d.label}</Text>
                      <Text style={[styles.durPrice, active && { color: C.purpleL }]}>${usd}</Text>
                    </PressableScale>
                  );
                })}
              </View>
              <View style={styles.btnRow}>
                <PressableScale style={styles.backBtn} onPress={() => animateTo(0)}>
                  <Ionicons name="arrow-back" size={16} color={C.textSub} />
                  <Text style={styles.backBtnText}>Back</Text>
                </PressableScale>
                <PressableScale style={[styles.nextBtn, { flex: 1 }]} onPress={() => animateTo(2)}>
                  <Text style={styles.nextBtnText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </PressableScale>
              </View>
            </View>
          )}

          {/* Step 2 — Confirm */}
          {step === 2 && (
            <View style={styles.stepWrap}>
              <Text style={styles.stepHeading}>Confirm & pay</Text>
              <View style={styles.summaryCard}>
                <SummaryRow k="Tier" v={selTier.charAt(0).toUpperCase() + selTier.slice(1)} />
                <SummaryRow k="Duration" v={selHours < 24 ? `${selHours} hour${selHours > 1 ? 's' : ''}` : `${selHours / 24} day${selHours / 24 > 1 ? 's' : ''}`} />
                <SummaryRow k="Compute" v={activeTier ? `${activeTier.cpu_vcpu} vCPU · ${activeTier.memory_gb} GB RAM` : '—'} />
                <View style={styles.divider} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalKey}>Total (approx)</Text>
                  <Text style={styles.totalVal}>${totalUSD} USDC</Text>
                </View>
                <Text style={styles.payNote}>Paid via Dexter Cash · x402 · Base network · No account needed</Text>
              </View>

              <View style={styles.trustGrid}>
                {([
                  { icon: 'lock-closed', text: 'Key stays on device' },
                  { icon: 'link',        text: 'On-chain payment' },
                  { icon: 'globe',       text: 'Akash Network' },
                  { icon: 'time',        text: 'Ready in ~3 min' },
                ] as { icon: IconName; text: string }[]).map(b => (
                  <View key={b.text} style={styles.trustChip}>
                    <Ionicons name={b.icon} size={13} color={C.purpleL} />
                    <Text style={styles.trustText}>{b.text}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.btnRow}>
                <PressableScale style={styles.backBtn} onPress={() => animateTo(1)}>
                  <Ionicons name="arrow-back" size={16} color={C.textSub} />
                  <Text style={styles.backBtnText}>Back</Text>
                </PressableScale>
                <PressableScale style={[styles.payBtn, loading && { opacity: 0.5 }]} onPress={launch} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="rocket" size={16} color="#fff" />
                      <View style={{ alignItems: 'center' }}>
                        <Text style={styles.payBtnText}>Pay & Start Mining</Text>
                        <Text style={styles.payBtnSub}>${totalUSD} USDC</Text>
                      </View>
                    </View>
                  )}
                </PressableScale>
              </View>
            </View>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryKey}>{k}</Text>
      <Text style={styles.summaryVal}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: C.bg },
  center:       { alignItems: 'center', justifyContent: 'center' },
  loadingText:  { color: C.textSub, marginTop: 14, fontSize: 14 },
  topHeader:    { paddingHorizontal: 24, marginBottom: 28 },
  title:        { color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subtitle:     { color: C.textSub, fontSize: 13, marginTop: 4 },
  stepWrap:     { paddingHorizontal: 16, gap: 12 },
  stepHeading:  { color: C.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 8, marginBottom: 4 },
  // Tier cards
  tierCard:     { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.bgCard, borderRadius: radius.lg, padding: 16, borderWidth: 1.5, borderColor: C.border, position: 'relative', ...shadow.card },
  tierIconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tierInfo:     { flex: 1, gap: 2 },
  tierName:     { color: C.text, fontSize: 16, fontWeight: '700' },
  tierSpec:     { color: C.textDim, fontSize: 12 },
  tierTagline:  { fontSize: 11, fontWeight: '600' },
  tierPriceWrap:{ alignItems: 'flex-end' },
  tierPrice:    { color: C.textSub, fontSize: 15, fontWeight: '700' },
  tierPriceSub: { color: C.textDim, fontSize: 11 },
  activeCheck:  { position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  // Duration
  durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  durCard:      { width: '47.5%', backgroundColor: C.bgCard, borderRadius: radius.lg, padding: 20, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', gap: 6 },
  durCardActive:{ borderColor: C.purple, backgroundColor: C.purpleD },
  durLabel:     { color: C.textSub, fontSize: 15, fontWeight: '700' },
  durLabelActive:{ color: C.text },
  durPrice:     { color: C.textDim, fontSize: 13, fontWeight: '600' },
  // Summary
  summaryCard:  { backgroundColor: C.bgCard, borderRadius: radius.xl, padding: 20, borderWidth: 1, borderColor: C.border, ...shadow.card },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  summaryKey:   { color: C.textSub, fontSize: 14 },
  summaryVal:   { color: C.text, fontSize: 14, fontWeight: '600' },
  divider:      { height: 1, backgroundColor: C.border, marginVertical: 4 },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  totalKey:     { color: C.text, fontSize: 15, fontWeight: '600' },
  totalVal:     { color: C.purpleL, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  payNote:      { color: C.textDim, fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 16 },
  // Trust
  trustGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trustChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bgCard, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.border },
  trustText:    { color: C.textSub, fontSize: 11 },
  // Buttons
  btnRow:       { flexDirection: 'row', gap: 10 },
  backBtn:      { flexDirection: 'row', gap: 6, backgroundColor: C.bgCard, borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  backBtnText:  { color: C.textSub, fontSize: 14, fontWeight: '600' },
  nextBtn:      { flexDirection: 'row', gap: 8, backgroundColor: C.purple, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', ...shadow.glow },
  nextBtnText:  { color: '#fff', fontSize: 15, fontWeight: '700' },
  payBtn:       { flex: 1, backgroundColor: C.purple, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  payBtnText:   { color: '#fff', fontSize: 15, fontWeight: '800' },
  payBtnSub:    { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
});
