import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  /** Stagger delay in ms before this item animates in. */
  delay?: number;
  /** Distance (px) it travels up into place. Default 14. */
  offset?: number;
  style?: StyleProp<ViewStyle>;
}

/** Fades + slides its children up into place on mount. Native-driven. */
export default function FadeSlideIn({ children, delay = 0, offset = 14, style }: Props) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
