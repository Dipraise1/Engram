import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Clipboard,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateKeypair, loadKeypair, deleteKeypair, KeyPair } from '../services/keystore';
import { gateway } from '../services/gateway';
import PressableScale from '../components/PressableScale';
import { C, radius, shadow } from '../theme';

function CopyBtn({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const tap = () => {
    Clipboard.setString(value);
    setCopied(true);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <TouchableOpacity onPress={tap} activeOpacity={0.8}>
      <Animated.View style={[styles.copyBtn, { transform: [{ scale }], backgroundColor: copied ? C.greenD : C.purpleD }]}>
        <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={13} color={copied ? C.green : C.purpleL} />
        <Text style={[styles.copyText, { color: copied ? C.green : C.purpleL }]}>{copied ? 'Copied' : label ?? 'Copy'}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function SectionCard({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <View style={[styles.card, danger && styles.cardDanger]}>
      <Text style={[styles.cardTitle, danger && { color: C.red }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function WalletScreen({ onNeedOnboarding }: { onNeedOnboarding?: () => void }) {
  const insets = useSafeAreaInsets();
  const [keypair, setKeypair]       = useState<KeyPair | null>(null);
  const [metagraph, setMetagraph]   = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showPhrase, setShowPhrase] = useState(false);

  useEffect(() => {
    loadKeypair().then(kp => { setKeypair(kp); setLoading(false); if (kp) fetchMeta(); });
  }, []);

  const fetchMeta = async () => {
    try { setMetagraph(await gateway.getMetagraph(450)); } catch {}
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const kp = await generateKeypair();
      setKeypair(kp);
      setShowPhrase(true);
      fetchMeta();
    } finally { setGenerating(false); }
  };

  const del = () => Alert.alert(
    'Delete wallet?',
    'This permanently removes your keys from this device. Make sure your recovery phrase is saved.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteKeypair(); setKeypair(null); setMetagraph(null); } },
    ]
  );

  if (loading) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={C.purple} />
      </View>
    );
  }

  if (!keypair) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <View style={styles.emptyIcon}><Ionicons name="wallet-outline" size={40} color={C.purpleL} /></View>
        <Text style={styles.emptyTitle}>No Wallet</Text>
        <Text style={styles.emptySub}>Generate an sr25519 keypair to start mining. Your private key never leaves this device.</Text>
        <PressableScale style={styles.createBtn} onPress={generate} disabled={generating}>
          {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.createBtnText}>Generate Keypair</Text>}
        </PressableScale>
      </View>
    );
  }

  const ss58Short = keypair.ss58.slice(0, 8) + '…' + keypair.ss58.slice(-6);
  const words = keypair.mnemonic.split(' ');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Wallet</Text>
          {metagraph && (
            <View style={styles.networkRow}>
              <View style={styles.liveGreen} />
              <Text style={styles.networkText}>Subnet 450 · Block #{String(metagraph.block).slice(-6)}</Text>
            </View>
          )}
        </View>
        <View style={styles.secureChip}>
          <Ionicons name="lock-closed" size={11} color={C.green} />
          <Text style={styles.secureText}>Secure Enclave</Text>
        </View>
      </View>

      {/* Identity card */}
      <SectionCard title="MINING IDENTITY">
        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Ionicons name="finger-print" size={22} color={C.purpleL} />
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.identityAddress} selectable>{ss58Short}</Text>
            <Text style={styles.identityHex} selectable numberOfLines={1} ellipsizeMode="middle">
              0x{keypair.publicHex}
            </Text>
          </View>
          <CopyBtn value={keypair.ss58} label="Copy SS58" />
        </View>
        <View style={styles.safeTag}>
          <Ionicons name="arrow-up-circle-outline" size={13} color={C.green} />
          <Text style={styles.safeTagText}>Safe to share · This is your public hotkey</Text>
        </View>
      </SectionCard>

      {/* Recovery phrase */}
      <SectionCard title="RECOVERY PHRASE" danger>
        <View style={styles.phraseHeader}>
          <Text style={styles.phraseWarn}>Private · Never share this</Text>
          <TouchableOpacity onPress={() => setShowPhrase(v => !v)} activeOpacity={0.8} style={styles.revealBtn}>
            <Text style={styles.revealText}>{showPhrase ? 'Hide' : 'Reveal'}</Text>
          </TouchableOpacity>
        </View>
        {showPhrase ? (
          <>
            <View style={styles.wordGrid}>
              {words.map((w, i) => (
                <View key={i} style={styles.wordChip}>
                  <Text style={styles.wordNum}>{i + 1}</Text>
                  <Text style={styles.wordText}>{w}</Text>
                </View>
              ))}
            </View>
            <CopyBtn value={keypair.mnemonic} label="Copy all 12 words" />
          </>
        ) : (
          <View style={styles.phraseMask}>
            <Text style={styles.phraseMaskText}>●●●●  ●●●●  ●●●●</Text>
            <Text style={styles.phraseMaskSub}>Tap Reveal to display your recovery phrase</Text>
          </View>
        )}
      </SectionCard>

      {/* Network info */}
      {metagraph && (
        <SectionCard title="BITTENSOR NETWORK">
          <View style={styles.netGrid}>
            {[
              { k: 'Network',  v: String(metagraph.network) },
              { k: 'NetUID',   v: String(metagraph.netuid) },
              { k: 'Block',    v: `#${metagraph.block}` },
            ].map(({ k, v }) => (
              <View key={k} style={styles.netRow}>
                <Text style={styles.netKey}>{k}</Text>
                <Text style={styles.netVal}>{v}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      )}

      {/* Danger zone */}
      <PressableScale style={styles.deleteBtn} onPress={del} dim={false}>
        <Ionicons name="trash-outline" size={16} color={C.red} />
        <Text style={styles.deleteBtnText}>Delete Wallet from Device</Text>
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: C.bg },
  center:       { alignItems: 'center', justifyContent: 'center', padding: 32 },
  // Page header
  pageHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 24, marginBottom: 24 },
  pageTitle:    { color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  networkRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveGreen:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  networkText:  { color: C.textSub, fontSize: 12 },
  secureChip:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.greenD, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.green + '33' },
  secureText:   { color: C.green, fontSize: 11, fontWeight: '600' },
  // Cards
  card:         { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.bgCard, borderRadius: radius.xl, padding: 20, borderWidth: 1, borderColor: C.border, ...shadow.card },
  cardDanger:   { borderColor: C.red + '33' },
  cardTitle:    { color: C.textSub, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 16, textTransform: 'uppercase' },
  // Identity
  identityRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: C.purpleD, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.borderAct },
  identityInfo: { flex: 1, gap: 3 },
  identityAddress: { color: C.text, fontSize: 14, fontWeight: '700', fontFamily: 'monospace' },
  identityHex:  { color: C.textDim, fontSize: 10, fontFamily: 'monospace' },
  safeTag:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.greenD, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  safeTagText:  { color: C.green, fontSize: 11, fontWeight: '500' },
  // Copy
  copyBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 6 },
  copyText:     { fontSize: 12, fontWeight: '700' },
  // Phrase
  phraseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  phraseWarn:   { color: C.red, fontSize: 12, fontWeight: '600' },
  revealBtn:    { backgroundColor: C.redD, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 5 },
  revealText:   { color: C.red, fontSize: 12, fontWeight: '700' },
  wordGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 },
  wordChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, width: '30.5%', borderWidth: 1, borderColor: C.border },
  wordNum:      { color: C.textDim, fontSize: 10, fontWeight: '700', minWidth: 14 },
  wordText:     { color: C.text, fontSize: 12, fontWeight: '600' },
  phraseMask:   { alignItems: 'center', paddingVertical: 24, gap: 8 },
  phraseMaskText:{ color: C.textDim, fontSize: 24, letterSpacing: 8 },
  phraseMaskSub: { color: C.textDim, fontSize: 12 },
  // Network
  netGrid:      { gap: 0 },
  netRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  netKey:       { color: C.textSub, fontSize: 13 },
  netVal:       { color: C.text, fontSize: 13, fontWeight: '600', fontFamily: 'monospace' },
  // Empty
  emptyIcon:    { width: 88, height: 88, borderRadius: 44, backgroundColor: C.purpleD, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: C.borderAct, ...shadow.glow },
  emptyTitle:   { color: C.text, fontSize: 22, fontWeight: '800', marginBottom: 10 },
  emptySub:     { color: C.textSub, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28, maxWidth: 280 },
  createBtn:    { backgroundColor: C.purple, borderRadius: radius.full, paddingVertical: 16, paddingHorizontal: 36, ...shadow.glow },
  createBtnText:{ color: '#fff', fontSize: 15, fontWeight: '700' },
  // Delete
  deleteBtn:    { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 8, backgroundColor: C.bgCard, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.red + '33' },
  deleteBtnText:{ color: C.red, fontSize: 14, fontWeight: '600' },
});
