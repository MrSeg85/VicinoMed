import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { useAuth, routeForUser } from '../../src/AuthContext';
import { Logo } from '../../src/components/Logo';

export default function Register() {
  const theme = useTheme();
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email || !password || !name) {
      setError('Compila tutti i campi obbligatori.');
      return;
    }
    if (password.length < 6) {
      setError('La password deve avere almeno 6 caratteri.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const u = await register(email.trim(), password, name.trim(), role, phone.trim() || undefined);
      router.replace(routeForUser(u) as any);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Registrazione fallita.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Logo size={64} />
          <Text style={[styles.brand, { color: theme.text }]}>Crea il tuo account</Text>
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>
            Inizia a prenotare visite specialistiche
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.roleRow}>
            {(['patient', 'doctor'] as const).map(r => (
              <TouchableOpacity
                key={r}
                testID={`register-role-${r}`}
                style={[
                  styles.roleBtn,
                  { borderColor: theme.border, backgroundColor: role === r ? theme.primary : theme.surfaceAlt },
                ]}
                onPress={() => setRole(r)}
              >
                <Ionicons
                  name={r === 'patient' ? 'person-outline' : 'medkit-outline'}
                  size={18}
                  color={role === r ? theme.primaryFg : theme.text}
                />
                <Text style={{ color: role === r ? theme.primaryFg : theme.text, fontWeight: '600', marginLeft: 8 }}>
                  {r === 'patient' ? 'Paziente' : 'Medico'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="person-outline" size={20} color={theme.textSecondary} />
            <TextInput
              testID="register-name"
              style={[styles.inputText, { color: theme.text }]}
              placeholder="Nome e cognome"
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="mail-outline" size={20} color={theme.textSecondary} />
            <TextInput
              testID="register-email"
              style={[styles.inputText, { color: theme.text }]}
              placeholder="Email"
              placeholderTextColor={theme.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="call-outline" size={20} color={theme.textSecondary} />
            <TextInput
              testID="register-phone"
              style={[styles.inputText, { color: theme.text }]}
              placeholder="Telefono (opzionale)"
              placeholderTextColor={theme.textMuted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <View style={[styles.input, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.textSecondary} />
            <TextInput
              testID="register-password"
              style={[styles.inputText, { color: theme.text }]}
              placeholder="Password (min 6 caratteri)"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {error && <Text style={[styles.error, { color: theme.error }]}>{error}</Text>}

          <Text style={[styles.privacy, { color: theme.textMuted }]}>
            Continuando accetti i Termini di servizio e l&apos;Informativa sulla privacy (GDPR).
          </Text>

          <TouchableOpacity
            testID="register-submit"
            style={[styles.btn, { backgroundColor: theme.primary }]}
            onPress={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.primaryFg} />
            ) : (
              <Text style={[styles.btnText, { color: theme.primaryFg }]}>Crea account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signupRow}>
            <Text style={{ color: theme.textSecondary }}>Hai già un account? </Text>
            <Link href="/auth/login" asChild>
              <TouchableOpacity testID="register-go-login">
                <Text style={{ color: theme.primary, fontWeight: '700' }}>Accedi</Text>
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
  header: { alignItems: 'center', marginBottom: 24 },
  brand: { fontSize: 24, fontWeight: '800', marginTop: 16 },
  tagline: { fontSize: 14, marginTop: 4, textAlign: 'center' },
  card: { padding: 24, borderRadius: 24, borderWidth: 1, maxWidth: 480, alignSelf: 'stretch', width: '100%', marginHorizontal: 'auto' as any },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 14, borderWidth: 1 },
  input: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 12,
  },
  inputText: { flex: 1, fontSize: 15 },
  error: { fontSize: 13, marginBottom: 8 },
  privacy: { fontSize: 12, marginTop: 6, marginBottom: 16, lineHeight: 18 },
  btn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '700' },
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 16 },
});
