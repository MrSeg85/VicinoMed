import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, routeForUser } from '../src/AuthContext';
import { useTheme } from '../src/useTheme';
import { Logo } from '../src/components/Logo';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  // Soft fade-in on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  // Smart redirect: onboarding → role-based home
  useEffect(() => {
    if (loading) return;
    (async () => {
      const seen = await AsyncStorage.getItem('vm_onboarded');
      if (!seen) {
        router.replace('/onboarding');
        return;
      }
      router.replace(routeForUser(user) as any);
    })();
  }, [user, loading, router]);

  const subtitle = loading
    ? 'Caricamento in corso…'
    : user?.role === 'doctor'
      ? `Bentornato ${user.name.split(' ')[0]}`
      : user
        ? `Ciao ${user.name.split(' ')[0]}`
        : 'La tua salute, vicino a te';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]} testID="splash-screen">
      <Animated.View style={[styles.center, { opacity, transform: [{ translateY }] }]}>
        <Logo size={96} />
        <Text style={[styles.brand, { color: theme.text }]}>VicinoMed</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        <View style={[styles.loaderTrack, { backgroundColor: theme.surfaceAlt }]}>
          <PulseBar color={theme.primary} />
        </View>
      </Animated.View>
    </View>
  );
}

/** Continuous pulsing progress bar (no spinning circle). */
function PulseBar({ color }: { color: string }) {
  const x = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  const translateX = x.interpolate({ inputRange: [-1, 1], outputRange: [-80, 80] });
  return (
    <Animated.View
      style={[styles.loaderFill, { backgroundColor: color, transform: [{ translateX }] }]}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 26, fontWeight: '800', marginTop: 20, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 6, textAlign: 'center' },
  loaderTrack: { width: 140, height: 4, borderRadius: 4, marginTop: 32, overflow: 'hidden' },
  loaderFill: { width: 60, height: 4, borderRadius: 4 },
});
