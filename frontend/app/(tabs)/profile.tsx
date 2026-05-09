import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { useAuth } from '../../src/AuthContext';
import { Logo } from '../../src/components/Logo';

export default function Profile() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();

  const isDoctor = user?.role === 'doctor';

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Logo size={72} />
        <Text style={[styles.title, { color: theme.text, textAlign: 'center' }]}>Accedi al tuo account</Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary }]} onPress={() => router.push('/auth/login')}>
          <Text style={[styles.btnText, { color: theme.primaryFg }]}>Accedi</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <View style={styles.avatar}>
            {user.picture ? (
              <Image source={{ uri: user.picture }} style={{ width: 88, height: 88, borderRadius: 44 }} />
            ) : (
              <Text style={{ color: theme.primary, fontSize: 36, fontWeight: '800' }}>
                {user.name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.rolePill}>
            <Ionicons name={isDoctor ? 'medkit' : 'person'} size={14} color={theme.primary} />
            <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
              {isDoctor ? 'Medico' : 'Paziente'}
            </Text>
          </View>
        </View>

        {isDoctor && (
          <TouchableOpacity
            testID="open-doctor-dashboard"
            style={[styles.dashboard, { backgroundColor: theme.secondary }]}
            onPress={() => router.push('/doctor-dashboard')}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.secondaryFg, fontSize: 12, fontWeight: '700', letterSpacing: 1, opacity: 0.85 }}>DASHBOARD MEDICO</Text>
              <Text style={{ color: theme.secondaryFg, fontSize: 18, fontWeight: '700', marginTop: 4 }}>
                Gestisci i tuoi pazienti
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={22} color={theme.secondaryFg} />
          </TouchableOpacity>
        )}

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle theme={theme} icon="settings-outline" title="Impostazioni" />
          <Row theme={theme} icon="moon-outline" label="Tema" value="Automatico" />
          <Row theme={theme} icon="notifications-outline" label="Notifiche" right={<Switch value={true} disabled trackColor={{ true: theme.secondary }} />} />
          <Row theme={theme} icon="logo-whatsapp" label="Promemoria via WhatsApp" right={<Switch value={true} disabled trackColor={{ true: theme.whatsapp }} />} />
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SectionTitle theme={theme} icon="document-text-outline" title="Account & GDPR" />
          <Row theme={theme} icon="lock-closed-outline" label="Privacy & GDPR" />
          <Row theme={theme} icon="document-outline" label="Termini di servizio" />
          <Row theme={theme} icon="help-circle-outline" label="Aiuto e supporto" />
        </View>

        <TouchableOpacity
          testID="logout-button"
          style={[styles.logout, { borderColor: theme.error }]}
          onPress={async () => { await logout(); router.replace('/auth/login'); }}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.error} />
          <Text style={{ color: theme.error, fontWeight: '700', marginLeft: 8 }}>Esci</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: theme.textMuted }]}>VicinoMed v1.0 — Made with ♡ in Italia</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ theme, icon, title }: any) {
  return (
    <View style={styles.sectionTitle}>
      <Ionicons name={icon} size={18} color={theme.primary} />
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 8 }}>{title}</Text>
    </View>
  );
}

function Row({ theme, icon, label, value, right }: any) {
  return (
    <View style={[styles.row, { borderTopColor: theme.border }]}>
      <Ionicons name={icon} size={20} color={theme.textSecondary} />
      <Text style={{ color: theme.text, fontSize: 15, flex: 1, marginLeft: 12 }}>{label}</Text>
      {value && <Text style={{ color: theme.textSecondary, fontSize: 13, marginRight: 8 }}>{value}</Text>}
      {right || <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: 32, alignItems: 'center', borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  name: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  email: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFFFFF', borderRadius: 999, marginTop: 12 },
  dashboard: { flexDirection: 'row', alignItems: 'center', margin: 16, padding: 18, borderRadius: 18 },
  section: { marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 18, borderWidth: 1 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 16, padding: 16, borderRadius: 16, borderWidth: 1 },
  version: { textAlign: 'center', fontSize: 12, marginTop: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  btn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  btnText: { fontSize: 14, fontWeight: '700' },
});
