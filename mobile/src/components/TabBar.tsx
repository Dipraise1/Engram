import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, radius } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; icon: IconName; label: string }[] = [
  { name: 'Dashboard',    icon: 'pulse',           label: 'Mine' },
  { name: 'Start Mining', icon: 'rocket',          label: 'Launch' },
  { name: 'Wallet',       icon: 'shield-checkmark', label: 'Wallet' },
];

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 12 }]}>
      <View style={styles.bar}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const tab = TABS[i];
          return (
            <TabItem
              key={route.key}
              icon={tab.icon}
              label={tab.label}
              focused={focused}
              onPress={() => {
                if (!focused) navigation.navigate(route.name);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({ icon, label, focused, onPress }: {
  icon: IconName; label: string; focused: boolean; onPress: () => void;
}) {
  const glow = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(focused ? 1 : 0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(glow,  { toValue: focused ? 1 : 0, useNativeDriver: false, tension: 80, friction: 10 }),
      Animated.spring(scale, { toValue: focused ? 1 : 0.9, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start();
  }, [focused]);

  const bgColor = glow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(124,58,237,0)', 'rgba(124,58,237,0.15)'] });
  const borderColor = glow.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0)', 'rgba(124,58,237,0.4)'] });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.item}>
      <Animated.View style={[styles.pill, { backgroundColor: bgColor, borderColor }]}>
        <Animated.View style={[styles.pillInner, { transform: [{ scale }] }]}>
          <Ionicons name={icon} size={17} color={focused ? C.purpleL : C.textDim} />
          <Text style={[styles.label, { color: focused ? C.purpleL : C.textDim }]}>{label}</Text>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  bar:       { flexDirection: 'row', paddingHorizontal: 12 },
  item:      { flex: 1, alignItems: 'center' },
  pill:      { borderRadius: radius.full, borderWidth: 1, overflow: 'hidden' },
  pillInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8 },
  label:     { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
});
