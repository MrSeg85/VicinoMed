import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/AuthContext';
import { useTheme } from '../src/useTheme';
import { Logo } from '../src/components/Logo';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    if (loading) return;
    (async () => {
      const seen = await AsyncStorage.getItem('vm_onboarded');
      if (!seen) {
        router.replace('/onboarding');
        return;
      }
      if (user) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/auth/login');
      }
    })();
  }, [user, loading, router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]} testID="splash-screen">
      <Logo size={96} />
      <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 32 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
