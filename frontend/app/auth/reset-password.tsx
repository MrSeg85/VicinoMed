import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { api, setToken } from '../../src/api';
import { useAuth, routeForUser } from '../../src/AuthContext';
import { Logo } from '../../src/components/Logo';

interface RuleCheck { ok: boolean; label: string }

export default function ResetPassword() {
  const theme = useTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { refresh } = useAuth();

  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const rules: RuleCheck[] = useMemo(() => ([
    { ok: pw.length >= 8, label: 'Almeno 8 caratteri' },
    { ok: /[A-Z]/.test(pw), label: 'Una lettera maiuscola' },
    { ok: /[0-9]/.test(pw), label: 'Un numero' },
  ]), [pw]);
  const allOk = rules.every(r => r.ok);
  const matches = pw.length > 0 && pw === confirm;

  const onSubmit = async () => {
    if (!token) { setError('Token mancante.'); return; }
    if (!allOk) { setError('La password non rispetta i requisiti.'); return; }
    if (!matches) { setError('Le password non coincidono.'); return; }
    setLoading(true); setError(null);
    try {
      const r = await api.post('/auth/reset-password', { token, new_password: pw });
      // Auto-login: backend returns a JWT
      await setToken(r.data.session_token);
      await refresh();
      setDone(true);
      // Redirect role-based after a short success animation
      setTimeout(() => router.replace(routeForUser(r.data.user) as any), 1400);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Reset fallito.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <View style={[styles.errorWrap, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle" size={56} color={theme.error} />
        <Text style={[styles.errorTitle, { color: theme.text }]}>Link non valido</Text>
        <Text style={[styles.errorSub, { color: theme.textSecondary }]}>
          Il link di reset è incompleto o danneggiato. Richiedine uno nuovo.
        </Text>
        <TouchableOpacity
          testID="reset-noticket-back"
          style={[styles.btn, { backgroundColor: theme.primary, marginTop: 20 }]}
          onPress={() => router.replace('/auth/forgot-password')}
        >
          <Text style={[styles.btnText, { color: theme.primaryFg }]}>Richiedi nuovo link</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[styles.successWrap, { backgroundColor: theme.background }]}>
        <View style={[styles.successIcon, { backgroundColor: theme.secondary }]}>
          <Ionicons name="checkmark" size={48} color={theme.secondaryFg} />
        </View>
        <Text style={[styles.successTitle, { color: theme.text }]} testID="reset-success">
          Password aggiornata
        </Text>
        <Text style={[styles.successSub, { color: theme.textSecondary }]}>
          Accesso effettuato. Reindirizzamento in corso…
        </Text>
        <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Logo size={64} />
          <Text style={[styles.title, { color: theme.text }]}>Nuova password</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Imposta una password sicura per il tuo account.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />
            <TextInput
              testID="reset-password"
              style={[styles.inputText, { color: theme.text }]}
              placeholder="Nuova password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showPw}
              value={pw}
              onChangeText={setPw}
            />
            <TouchableOpacity onPress={() => setShowPw(!showPw)} testID="reset-toggle-pw">
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />
            <TextInput
              testID="reset-confirm"
              style={[styles.inputText, { color: theme.text }]}
              placeholder="Conferma password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showPw}
              value={confirm}
              onChangeText={setConfirm}
            />
            {confirm.length > 0 && (
              <Ionicons
                name={matches ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={matches ? theme.success : theme.error}
              />
            )}
          </View>

          {/* Rule checklist */}
          <View style={[styles.rules, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
            {rules.map((r, i) => (
              <View key={i} style={styles.ruleRow} testID={`rule-${i}`}>
                <Ionicons
                  name={r.ok ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={r.ok ? theme.success : theme.textMuted}
                />
                <Text style={{ color: r.ok ? theme.success : theme.textSecondary, fontSize: 13, marginLeft: 8 }}>
                  {r.label}
                </Text>
              </View>
            ))}
          </View>

          {error && <Text style={[styles.error, { color: theme.error }]}>{error}</Text>}

          <TouchableOpacity
            testID="reset-submit"
            style={[
              styles.btn,
              { backgroundColor: allOk && matches ? theme.primary : theme.surfaceAlt, marginTop: 16 },
            ]}
            onPress={onSubmit}
            disabled={loading || !allOk || !matches}
          >
            {loading
              ? <ActivityIndicator color={theme.primaryFg} />
              : (
                <Text style={[
                  styles.btnText,
                  { color: allOk && matches ? theme.primaryFg : theme.textMuted },
                ]}>
                  Reimposta password
                </Text>
              )}
          </TouchableOpacity>

          <Text style={[styles.note, { color: theme.textMuted }]}>
            🔒 Tutte le sessioni attive verranno disconnesse per sicurezza.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '800', marginTop: 16, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 8, textAlign: 'center' },

  card: { padding: 24, borderRadius: 24, borderWidth: 1, maxWidth: 480, alignSelf: 'stretch', width: '100%', marginHorizontal: 'auto' as any },
  input: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 12,
  },
  inputText: { flex: 1, fontSize: 15 },

  rules: { padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 4, gap: 6 },
  ruleRow: { flexDirection: 'row', alignItems: 'center' },

  error: { fontSize: 13, marginTop: 12 },
  btn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '700' },
  note: { fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 18 },

  successWrap: { flex: 1, padding: 32, paddingTop: 100, alignItems: 'center' },
  successIcon: {
    width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    shadowColor: '#00C48C', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  successTitle: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  successSub: { fontSize: 15, marginTop: 12, textAlign: 'center', maxWidth: 320 },

  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { fontSize: 22, fontWeight: '800', marginTop: 16 },
  errorSub: { fontSize: 14, marginTop: 8, textAlign: 'center', maxWidth: 320 },
});
