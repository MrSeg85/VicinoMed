import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../useTheme';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide?: () => void;
}

const ICON: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

export function Toast({ visible, message, type = 'info', duration = 2800, onHide }: ToastProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(translate, { toValue: 0, useNativeDriver: true, friction: 8 }),
      ]).start();
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(translate, { toValue: 20, duration: 200, useNativeDriver: true }),
        ]).start(() => onHide && onHide());
      }, duration);
      return () => clearTimeout(t);
    }
  }, [visible, duration, onHide, opacity, translate]);

  if (!visible) return null;

  const bg =
    type === 'success' ? theme.success :
    type === 'error' ? theme.error :
    theme.primary;

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor: bg, opacity, transform: [{ translateY: translate }] },
        ]}
      >
        <Ionicons name={ICON[type]} size={20} color="#FFF" />
        <Text style={styles.text} numberOfLines={3}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 32 : 80,
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    maxWidth: '92%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    gap: 10,
  },
  text: { color: '#FFF', fontSize: 14, fontWeight: '700', flexShrink: 1 },
});
