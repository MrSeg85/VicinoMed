import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { useAuth } from '../../src/AuthContext';

export default function AdminSettings() {
  const theme = useTheme();
  const { user } = useAuth();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 24 }}>
      <Text style={[s.title, { color: theme.text }]}>Impostazioni</Text>
      <Text style={[s.sub, { color: theme.textSecondary }]}>Configurazione piattaforma</Text>

      <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={s.head}>
          <View style={[s.iconBox, { backgroundColor: theme.accent }]}>
            <Ionicons name="shield-checkmark" size={20} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: theme.text }]}>Account amministratore</Text>
            <Text style={[s.cardSub, { color: theme.textSecondary }]}>{user?.email}</Text>
          </View>
          <View style={[s.pill, { backgroundColor: theme.success }]}>
            <Text style={s.pillText}>VERIFICATO</Text>
          </View>
        </View>
      </View>

      <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 14 }]}>
        <View style={s.head}>
          <View style={[s.iconBox, { backgroundColor: '#F59E0B20' }]}>
            <Ionicons name="cash" size={20} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: theme.text }]}>Commissione piattaforma</Text>
            <Text style={[s.cardSub, { color: theme.textSecondary }]}>Applicata sui ricavi degli affitti stanze</Text>
          </View>
          <Text style={[s.bigValue, { color: '#F59E0B' }]}>10%</Text>
        </View>
        <View style={[s.note, { borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={14} color={theme.textMuted} />
          <Text style={[s.noteText, { color: theme.textMuted }]}>
            Modifica della percentuale via interfaccia in arrivo. Per ora configurabile lato server.
          </Text>
        </View>
      </View>

      <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 14 }]}>
        <View style={s.head}>
          <View style={[s.iconBox, { backgroundColor: '#06B6D420' }]}>
            <Ionicons name="information-circle" size={20} color="#06B6D4" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: theme.text }]}>Versione applicazione</Text>
            <Text style={[s.cardSub, { color: theme.textSecondary }]}>VicinoMed v1.2 · Fase Admin attiva</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '900' },
  sub: { fontSize: 13, marginTop: 4, marginBottom: 18 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  cardSub: { fontSize: 12, marginTop: 2 },
  bigValue: { fontSize: 24, fontWeight: '900' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pillText: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, padding: 10, borderRadius: 8, borderWidth: 1 },
  noteText: { fontSize: 11, flex: 1, fontStyle: 'italic' },
});
