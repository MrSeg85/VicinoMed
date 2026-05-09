import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props { size?: number }
export function Logo({ size = 64 }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <View style={[styles.inner, { borderRadius: size * 0.28 }]}>
        <Text style={[styles.cross, { fontSize: size * 0.5 }]}>+</Text>
        <View style={[styles.pin, { width: size * 0.2, height: size * 0.2, borderRadius: size * 0.1, bottom: size * 0.13, right: size * 0.13 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', shadowColor: '#0A3D62', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  inner: { flex: 1, backgroundColor: '#0A3D62', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  cross: { color: '#FFFFFF', fontWeight: '900', textAlign: 'center', includeFontPadding: false },
  pin: { backgroundColor: '#00C48C', position: 'absolute', borderWidth: 2, borderColor: '#FFFFFF' },
});
