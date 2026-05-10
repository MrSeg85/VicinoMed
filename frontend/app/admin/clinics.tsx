import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';

export default function AdminClinicsPlaceholder() {
  const theme = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 24 }}>
      <Text style={[styles.title, { color: theme.text }]}>Studi Medici</Text>
      <Text style={[styles.sub, { color: theme.textSecondary }]}>Tutte le cliniche e centri medici della piattaforma.</Text>
      <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.iconBig, { backgroundColor: theme.accent }]}>
          <Ionicons name="business" size={36} color={theme.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Sezione in costruzione</Text>
        <Text style={[styles.emptyMsg, { color: theme.textSecondary }]}>
          Backend pronto. UI tabella studi con stanze, richieste pending e proprietario è il prossimo task.
        </Text>
        <View style={[styles.endpoints, { borderColor: theme.border }]}>
          <Text style={[styles.endpointTitle, { color: theme.textMuted }]}>API DISPONIBILI</Text>
          <Text style={[styles.endpoint, { color: theme.text }]}>GET /api/admin/clinics?q=</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '900' },
  sub: { fontSize: 13, marginTop: 4, marginBottom: 24 },
  empty: { padding: 28, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  iconBig: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyMsg: { fontSize: 13, textAlign: 'center', marginTop: 8, maxWidth: 480, lineHeight: 19 },
  endpoints: { width: '100%' as any, marginTop: 22, padding: 14, borderRadius: 10, borderWidth: 1 },
  endpointTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  endpoint: { fontSize: 11, fontFamily: 'monospace', marginVertical: 2 },
});
