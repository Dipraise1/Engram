import React, { useRef } from 'react';
import {
  Animated, Pressable, PressableProps, StyleProp, ViewStyle,
} from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends PressableProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks while pressed. Default 0.96. */
  scaleTo?: number;
  /** Dim the content while pressed. Default true. */
  dim?: boolean;
}

/**
 * A Pressable that springs down on press and back on release — gives every
 * tappable surface a consistent, tactile feel. The scale/opacity live on the
 * Pressable itself, so layout styles (flex, padding, background) on `style`
 * behave exactly as they would on a plain Pressable. Honours `disabled`.
 */
export default function PressableScale({
  children, style, scaleTo = 0.96, dim = true, disabled, ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animate = (toScale: number, toOpacity: number) =>
    Animated.parallel([
      Animated.spring(scale, { toValue: toScale, useNativeDriver: true, tension: 300, friction: 18 }),
      Animated.timing(opacity, { toValue: toOpacity, duration: 90, useNativeDriver: true }),
    ]).start();

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => animate(scaleTo, dim ? 0.85 : 1)}
      onPressOut={() => animate(1, 1)}
      style={[style, { transform: [{ scale }], opacity: disabled ? 0.5 : opacity }]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
