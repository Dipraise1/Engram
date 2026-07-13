import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { C } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  score: number; // 0–1
  size?: number;
  label?: string;
}

export default function ScoreRing({ score, size = 130, label = 'Score' }: Props) {
  const sw = 9;
  const r  = (size - sw) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, score));

  const color = score > 0.8 ? C.purple : score > 0.5 ? C.amber : C.red;

  // One Animated value drives both the arc sweep and the count-up number.
  // SVG props can't run on the native driver, so this stays on the JS driver.
  const progress = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = progress.addListener(({ value }) => setDisplay(Math.round(value * clamped * 100)));
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => progress.removeListener(id);
  }, [clamped]);

  const offset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circ, circ * (1 - clamped)],
  });

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={C.purpleL} />
            <Stop offset="100%" stopColor={C.cyan} />
          </LinearGradient>
        </Defs>
        {/* Track */}
        <Circle cx={cx} cy={cy} r={r} stroke={C.border} strokeWidth={sw} fill="none" />
        {/* Progress */}
        <AnimatedCircle
          cx={cx} cy={cy} r={r}
          stroke={score > 0.8 ? 'url(#ring)' : color}
          strokeWidth={sw}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      <View style={[styles.center, { width: size, height: size }]}>
        <Text style={styles.score}>{display}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:   { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  score:  { color: C.text, fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  label:  { color: C.textSub, fontSize: 11, fontWeight: '500', marginTop: 2, letterSpacing: 0.5 },
});
