import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { useAuth, routeForUser } from '../../src/AuthContext';
import { Logo } from '../../src/components/Logo';

export default function Login() {
  const theme = useTheme();
  const { login, loginGoogle, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If user becomes authenticated (e.g. after Google OAuth on mobile), redirect by role.
  useEffect(() => {
    if (user) router.replace(routeForUser(user) as any);
  }, [user, router]);

  const onLogin = async () => {
    if (!email || !password) {
      setError('Inserisci email e password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const u = await login(email.trim(), password);
      router.replace(routeForUser(u) as any);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Accesso fallito.');
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoading(true);
    try {
      await loginGoogle();
      // On mobile: AuthContext sets `user` after processSessionId. The /index splash
      // (which we land on after auth) will redirect by role. We also handle here as fallback.
      // No-op if web (page redirect handles it).
    } catch (e: any) {
      setError('Login Google fallito.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Logo size={72} />
          <Text style={[styles.brand, { color: theme.text }]}>VicinoMed</Text>
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>
            La visita specialistica più vicina a te
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Bentornato</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Accedi al tuo account per continuare
          </Text>

          <View style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="mail-outline" size={20} color={theme.textSecondary} />
            <TextInput
              testID="login-email"
              style={[styles.inputText, { color: theme.text }]}
              placeholder="Email"
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />
            <TextInput
              testID="login-password"
              style={[styles.inputText, { color: theme.text }]}
              placeholder="Password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showPw}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {error && <Text style={[styles.error, { color: theme.error }]}>{error}</Text>}

          <TouchableOpacity
            testID="login-submit"
            style={[styles.btn, { backgroundColor: theme.primary }]}
            onPress={onLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.primaryFg} />
            ) : (
              <Text style={[styles.btnText, { color: theme.primaryFg }]}>Accedi</Text>
            )}
          </TouchableOpacity>

          <Link href="/auth/forgot-password" asChild>
            <TouchableOpacity testID="login-forgot" style={styles.forgotRow}>
              <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 14 }}>
                Hai dimenticato la password?
              </Text>
            </TouchableOpacity>
          </Link>

          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: theme.border }]} />
            <Text style={[styles.or, { color: theme.textMuted }]}>oppure</Text>
            <View style={[styles.line, { backgroundColor: theme.border }]} />
          </View>

          <TouchableOpacity
            testID="login-google"
            style={[styles.googleBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={onGoogle}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={20} color="#EA4335" />
            <Text style={[styles.googleText, { color: theme.text }]}>Continua con Google</Text>
          </TouchableOpacity>

          <View style={styles.signupRow}>
            <Text style={{ color: theme.textSecondary }}>Non hai un account? </Text>
            <Link href="/auth/register" asChild>
              <TouchableOpacity testID="login-go-register">
                <Text style={{ color: theme.primary, fontWeight: '700' }}>Registrati</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 32 },
  brand: { fontSize: 28, fontWeight: '800', marginTop: 16, letterSpacing: -0.5 },
  tagline: { fontSize: 14, marginTop: 6, textAlign: 'center' },
  card: { padding: 24, borderRadius: 24, borderWidth: 1, maxWidth: 480, alignSelf: 'stretch', width: '100%', marginHorizontal: 'auto' as any },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 20 },
  input: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 12,
  },
  inputText: { flex: 1, fontSize: 15 },
  error: { fontSize: 13, marginBottom: 8, marginTop: -4 },
  btn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  btnText: { fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
  line: { flex: 1, height: 1 },
  or: { fontSize: 13 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    height: 56, borderRadius: 16, borderWidth: 1,
  },
  googleText: { fontSize: 15, fontWeight: '600' },
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  forgotRow: { alignItems: 'center', marginTop: 14 },
});
