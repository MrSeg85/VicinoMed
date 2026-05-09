import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { api } from '../../src/api';
import { Logo } from '../../src/components/Logo';

export default function ForgotPassword() {
  const theme = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email.trim()) {
      setError('Inserisci la tua email.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
      // In dev mode the API returns the reset link so it can be tested without an email server
      if (r.data?.dev_mode && r.data?.reset_link) {
        setDevLink(r.data.reset_link);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 429) setError('Hai richiesto troppi reset. Riprova tra un\'ora.');
      else setError(e?.response?.data?.detail || 'Errore. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={[styles.successWrap, { backgroundColor: theme.background }]}>
        <View style={[styles.successIcon, { backgroundColor: theme.secondary }]}>
          <Ionicons name="mail" size={42} color={theme.secondaryFg} />
        </View>
        <Text style={[styles.successTitle, { color: theme.text }]} testID="forgot-success-title">
          Email inviata
        </Text>
        <Text style={[styles.successSub, { color: theme.textSecondary }]}>
          Se l&apos;indirizzo <Text style={{ fontWeight: '700' }}>{email}</Text> è registrato,
          riceverai a breve un link per reimpostare la password.{'\n'}Il link è valido per 1 ora.
        </Text>

        {devLink && (
          <View style={[styles.devCard, { backgroundColor: theme.warning + '15', borderColor: theme.warning }]} testID="forgot-dev-card">
            <View style={styles.devCardHeader}>
              <Ionicons name="construct" size={16} color={theme.warning} />
              <Text style={{ color: theme.warning, fontWeight: '800', fontSize: 11, letterSpacing: 1.5, marginLeft: 6 }}>
                MODALITÀ DEV — EMAIL NON INVIATA
              </Text>
            </View>
            <Text style={{ color: theme.text, fontSize: 13, marginTop: 6, lineHeight: 19 }}>
              In produzione configura <Text style={{ fontWeight: '700' }}>RESEND_API_KEY</Text>.
              Per ora puoi aprire direttamente il link di reset:
            </Text>
            <TouchableOpacity
              testID="forgot-dev-open"
              style={[styles.devBtn, { backgroundColor: theme.primary }]}
              onPress={() => router.replace(devLinkToInternal(devLink) as any)}
            >
              <Ionicons name="key" size={16} color={theme.primaryFg} />
              <Text style={{ color: theme.primaryFg, fontWeight: '700', marginLeft: 8 }}>
                Apri reset password
              </Text>
            </TouchableOpacity>
            <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }} numberOfLines={2}>
              {devLink}
            </Text>
          </View>
        )}

        <TouchableOpacity
          testID="forgot-back-login"
          style={[styles.backBtn, { borderColor: theme.border }]}
          onPress={() => router.replace('/auth/login')}
        >
          <Text style={{ color: theme.text, fontWeight: '600' }}>Torna al login</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setSent(false); setDevLink(null); }} style={{ marginTop: 12 }}>
          <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 13 }}>
            Non hai ricevuto l&apos;email? Riprova
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity testID="forgot-back" style={styles.headerBack} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginLeft: 8 }}>Indietro</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Logo size={64} />
          <Text style={[styles.title, { color: theme.text }]}>Password dimenticata?</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Inserisci l&apos;email del tuo account VicinoMed.{'\n'}Ti invieremo un link per crearne una nuova.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="mail-outline" size={20} color={theme.textSecondary} />
            <TextInput
              testID="forgot-email"
              style={[styles.inputText, { color: theme.text }]}
              placeholder="La tua email"
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={onSubmit}
              returnKeyType="send"
            />
          </View>

          {error && <Text style={[styles.error, { color: theme.error }]}>{error}</Text>}

          <TouchableOpacity
            testID="forgot-submit"
            style={[styles.btn, { backgroundColor: theme.primary }]}
            onPress={onSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={theme.primaryFg} />
              : <Text style={[styles.btnText, { color: theme.primaryFg }]}>Invia link di reset</Text>}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={{ color: theme.textSecondary }}>Ti sei ricordato? </Text>
            <Link href="/auth/login" asChild>
              <TouchableOpacity testID="forgot-go-login">
                <Text style={{ color: theme.primary, fontWeight: '700' }}>Accedi</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Convert the absolute reset URL returned by the backend into an Expo Router path. */
function devLinkToInternal(absUrl: string): string {
  try {
    const u = new URL(absUrl);
    return `/auth/reset-password?token=${encodeURIComponent(u.searchParams.get('token') || '')}`;
  } catch {
    return '/auth/login';
  }
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 40 },
  headerBack: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  header: { alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 26, fontWeight: '800', marginTop: 16, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 21 },

  card: { padding: 24, borderRadius: 24, borderWidth: 1, maxWidth: 480, alignSelf: 'stretch', width: '100%', marginHorizontal: 'auto' as any },
  input: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 12,
  },
  inputText: { flex: 1, fontSize: 15 },
  error: { fontSize: 13, marginBottom: 8 },
  btn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  btnText: { fontSize: 16, fontWeight: '700' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },

  successWrap: { flex: 1, padding: 32, paddingTop: 80, alignItems: 'center' },
  successIcon: {
    width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#00C48C', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  successTitle: { fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  successSub: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12, maxWidth: 360 },

  devCard: { width: '100%', maxWidth: 460, padding: 16, borderRadius: 16, borderWidth: 1, marginTop: 28 },
  devCardHeader: { flexDirection: 'row', alignItems: 'center' },
  devBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 14, marginTop: 14 },

  backBtn: { marginTop: 28, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
});
