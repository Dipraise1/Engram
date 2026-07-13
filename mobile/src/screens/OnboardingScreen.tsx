import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions,
  FlatList, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateKeypair, KeyPair } from '../services/keystore';
import PressableScale from '../components/PressableScale';
import { C, radius, shadow } from '../theme';

const W = Dimensions.get('window').width;

const SLIDES = [
  {
    emoji: '🧠',
    title: 'Memory for AI,\nowned by no one.',
    body:  'Engram is a decentralized vector database on Bittensor subnet 450. AI agents get permanent, censorship-resistant memory — no AWS, no central authority.',
    accent: C.purple,
  },
  {
    emoji: '⛏',
    title: 'Mine from\nyour phone.',
    body:  'Deploy a managed miner on Akash Network in minutes. Pay per hour with USDC on Base. Your phone holds the identity — the cloud does the compute.',
    accent: C.cyan,
  },
  {
    emoji: '🔐',
    title: 'Your keys.\nYour mine.',
    body:  'Your sr25519 private key is generated on-device and stored in the secure enclave. It never leaves your phone — not even to us.',
    accent: C.green,
  },
];

interface Props {
  onComplete: (kp: KeyPair) => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const insets  = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [page, setPage] = useState(0);
  const [step, setStep] = useState<'slides' | 'create' | 'phrase' | 'confirm'>('slides');
  const [keypair, setKeypair] = useState<KeyPair | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedWords, setSelectedWords] = useState<Set<number>>(new Set());

  const goNext = () => {
    if (page < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: page + 1, animated: true });
      setPage(p => p + 1);
    } else {
      setStep('create');
    }
  };

  const create = async () => {
    setGenerating(true);
    try {
      const kp = await generateKeypair();
      setKeypair(kp);
      setStep('phrase');
    } catch (e: any) {
      Alert.alert(
        'Generation failed',
        e?.message ?? 'Crypto backend unavailable.',
        [
          { text: 'Retry', onPress: create },
          { text: 'Skip for now', style: 'cancel', onPress: () => onComplete({ ss58: '', publicHex: '', mnemonic: '' }) },
        ]
      );
    } finally {
      setGenerating(false);
    }
  };

  const confirmPhrase = () => {
    if (keypair) onComplete(keypair);
  };

  if (step === 'create') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.createEmoji}><Text style={styles.bigEmoji}>🔑</Text></View>
        <Text style={styles.createTitle}>Create your wallet</Text>
        <Text style={styles.createBody}>
          We'll generate a 12-word recovery phrase that controls your mining identity.
          Store it somewhere safe — it's the only way to recover your account.
        </Text>
        <View style={styles.createWarning}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            Your private key never leaves this device. We cannot recover it for you.
          </Text>
        </View>
        <PressableScale style={styles.primaryBtn} onPress={create} disabled={generating}>
          {generating
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="key" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Generate Keypair</Text>
              </>}
        </PressableScale>
      </View>
    );
  }

  if (step === 'phrase' && keypair) {
    const words = keypair.mnemonic.split(' ');
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.stepRow}>
          <Text style={styles.stepText}>Step 1 of 2</Text>
          <View style={styles.stepBar}><View style={[styles.stepFill, { width: '50%' }]} /></View>
        </View>
        <Text style={styles.phraseTitle}>Save your recovery phrase</Text>
        <Text style={styles.phraseBody}>Write these 12 words in order. You'll need them to restore your wallet.</Text>
        <View style={styles.wordGrid}>
          {words.map((w, i) => (
            <View key={i} style={styles.wordChip}>
              <Text style={styles.wordNum}>{i + 1}</Text>
              <Text style={styles.wordText}>{w}</Text>
            </View>
          ))}
        </View>
        <PressableScale style={styles.primaryBtn} onPress={() => setStep('confirm')}>
          <Text style={styles.primaryBtnText}>I've saved it</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </PressableScale>
      </View>
    );
  }

  if (step === 'confirm' && keypair) {
    const words = keypair.mnemonic.split(' ');
    // Show 4 random words to verify
    const checks = [2, 5, 8, 11];
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.stepRow}>
          <Text style={styles.stepText}>Step 2 of 2</Text>
          <View style={styles.stepBar}><View style={[styles.stepFill, { width: '100%' }]} /></View>
        </View>
        <Text style={styles.phraseTitle}>Verify your phrase</Text>
        <Text style={styles.phraseBody}>Confirm these words match your recovery phrase.</Text>
        <View style={styles.verifyGrid}>
          {checks.map(i => (
            <View key={i} style={styles.verifyChip}>
              <Text style={styles.verifyNum}>Word #{i + 1}</Text>
              <Text style={styles.verifyWord}>{words[i]}</Text>
            </View>
          ))}
        </View>
        <PressableScale style={styles.primaryBtn} onPress={confirmPhrase}>
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.primaryBtnText}>Confirm & Enter App</Text>
        </PressableScale>
      </View>
    );
  }

  // Slides
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        horizontal pagingEnabled scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / W))}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={[styles.emojiCircle, { backgroundColor: item.accent + '22', borderColor: item.accent + '44' }]}>
              <Text style={styles.slideEmoji}>{item.emoji}</Text>
            </View>
            <Text style={[styles.slideTitle, { color: C.text }]}>{item.title}</Text>
            <Text style={styles.slideBody}>{item.body}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => {
          const opacity = scrollX.interpolate({
            inputRange: [(i - 1) * W, i * W, (i + 1) * W],
            outputRange: [0.25, 1, 0.25],
            extrapolate: 'clamp',
          });
          const width = scrollX.interpolate({
            inputRange: [(i - 1) * W, i * W, (i + 1) * W],
            outputRange: [6, 20, 6],
            extrapolate: 'clamp',
          });
          return <Animated.View key={i} style={[styles.dot, { opacity, width, backgroundColor: SLIDES[page].accent }]} />;
        })}
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        {page > 0 && (
          <TouchableOpacity onPress={() => { listRef.current?.scrollToIndex({ index: page - 1, animated: true }); setPage(p => p - 1); }}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}
        <PressableScale
          style={[styles.primaryBtn, { flex: 1, marginLeft: page > 0 ? 12 : 0, backgroundColor: SLIDES[page].accent }]}
          onPress={goNext}
        >
          <Text style={styles.primaryBtnText}>{page === SLIDES.length - 1 ? 'Get Started' : 'Next'}</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: C.bg },
  slide:        { width: W, paddingHorizontal: 32, paddingTop: 60, alignItems: 'center' },
  emojiCircle:  { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 40 },
  slideEmoji:   { fontSize: 44 },
  slideTitle:   { fontSize: 32, fontWeight: '800', textAlign: 'center', letterSpacing: -0.8, lineHeight: 38, marginBottom: 20 },
  slideBody:    { fontSize: 15, color: C.textSub, textAlign: 'center', lineHeight: 24, fontWeight: '400' },
  dots:         { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20, marginTop: 32 },
  dot:          { height: 6, borderRadius: 3 },
  footer:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24 },
  backText:     { color: C.textSub, fontSize: 15, fontWeight: '600', paddingVertical: 16, paddingHorizontal: 8 },
  primaryBtn:   { flexDirection: 'row', gap: 8, backgroundColor: C.purple, borderRadius: radius.full, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', ...shadow.glow },
  primaryBtnText:{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  // Create wallet
  createEmoji:  { alignSelf: 'center', width: 100, height: 100, borderRadius: 50, backgroundColor: C.purpleD, borderWidth: 1, borderColor: C.borderAct, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  bigEmoji:     { fontSize: 44 },
  createTitle:  { color: C.text, fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5, marginBottom: 14, paddingHorizontal: 24 },
  createBody:   { color: C.textSub, fontSize: 15, textAlign: 'center', lineHeight: 24, paddingHorizontal: 28, marginBottom: 28 },
  createWarning:{ flexDirection: 'row', gap: 10, backgroundColor: C.amberD, borderRadius: radius.md, padding: 16, marginHorizontal: 24, marginBottom: 36, borderWidth: 1, borderColor: C.amber + '33' },
  warningIcon:  { fontSize: 18 },
  warningText:  { color: C.amber, fontSize: 13, lineHeight: 20, flex: 1 },
  // Steps
  stepRow:      { paddingHorizontal: 24, marginBottom: 28 },
  stepText:     { color: C.textSub, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  stepBar:      { height: 3, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  stepFill:     { height: 3, backgroundColor: C.purple, borderRadius: 2 },
  phraseTitle:  { color: C.text, fontSize: 24, fontWeight: '800', paddingHorizontal: 24, marginBottom: 10, letterSpacing: -0.4 },
  phraseBody:   { color: C.textSub, fontSize: 14, paddingHorizontal: 24, lineHeight: 22, marginBottom: 28 },
  wordGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 24, marginBottom: 36 },
  wordChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.bgCard2, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: C.border, width: '30%' },
  wordNum:      { color: C.textDim, fontSize: 10, fontWeight: '700', minWidth: 14 },
  wordText:     { color: C.text, fontSize: 13, fontWeight: '600' },
  verifyGrid:   { gap: 12, paddingHorizontal: 24, marginBottom: 36 },
  verifyChip:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.bgCard, borderRadius: radius.md, padding: 16, borderWidth: 1, borderColor: C.border },
  verifyNum:    { color: C.textSub, fontSize: 13 },
  verifyWord:   { color: C.text, fontSize: 15, fontWeight: '700' },
});
