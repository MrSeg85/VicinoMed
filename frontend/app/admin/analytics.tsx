import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useTheme } from '../../src/useTheme';

interface Analytics {
  top_cities: { city: string; clinics: number; rooms: number }[];
  top_specialties: { specialty: string; doctors: number }[];
  requests_by_status_30d: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B', accepted: '#10B981', rejected: '#EF4444', cancelled: '#94A3B8',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'In attesa', accepted: 'Accettate', rejected: 'Rifiutate', cancelled: 'Annullate',
};

export default function AdminAnalytics() {
  const theme = useTheme();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/admin/analytics');
      setData(r.data);
    } catch (e) { console.warn('[AdminAnalytics] fail', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={[s.center, { backgroundColor: theme.background }]}><ActivityIndicator color={theme.primary} size="large" /></View>;

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replaceAll('_', ' ');
  const maxCity = Math.max(1, ...(data?.top_cities.map(c => c.clinics) || [1]));
  const maxSpec = Math.max(1, ...(data?.top_specialties.map(c => c.doctors) || [1]));
  const totalReqs = Object.values(data?.requests_by_status_30d || {}).reduce((a, b) => a + b, 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <Text style={[s.title, { color: theme.text }]}>Analytics</Text>
      <Text style={[s.sub, { color: theme.textSecondary }]}>Insight piattaforma in tempo reale</Text>

      {/* Requests by status (last 30d) */}
      <View style={[s.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={s.head}>
          <View style={[s.dot, { backgroundColor: '#F59E0B' }]} />
          <Text style={[s.sectionTitle, { color: theme.text }]}>Richieste stanza (30 giorni)</Text>
          <Text style={[s.totalText, { color: theme.textSecondary }]}>{totalReqs} totali</Text>
        </View>
        {totalReqs === 0 ? (
          <Text style={[s.empty, { color: theme.textMuted }]}>Nessuna richiesta negli ultimi 30 giorni.</Text>
        ) : (
          ['pending', 'accepted', 'rejected', 'cancelled'].map(status => {
            const count = data?.requests_by_status_30d[status] || 0;
            const pct = totalReqs > 0 ? (count / totalReqs) * 100 : 0;
            const color = STATUS_COLORS[status];
            return (
              <View key={status} style={s.row}>
                <View style={[s.statusDot, { backgroundColor: color }]} />
                <Text style={[s.rowLabel, { color: theme.text }]}>{STATUS_LABELS[status]}</Text>
                <View style={[s.bar, { backgroundColor: theme.surfaceAlt }]}>
                  <View style={[s.barFill, { width: `${Math.max(pct, 2)}%`, backgroundColor: color }]} />
                </View>
                <Text style={[s.rowValue, { color: theme.text }]}>{count}</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Top cities */}
      <View style={[s.section, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 16 }]}>
        <View style={s.head}>
          <View style={[s.dot, { backgroundColor: '#3B82F6' }]} />
          <Text style={[s.sectionTitle, { color: theme.text }]}>Top città (per studi)</Text>
        </View>
        {(data?.top_cities || []).length === 0 ? (
          <Text style={[s.empty, { color: theme.textMuted }]}>Nessuno studio registrato.</Text>
        ) : (
          (data?.top_cities || []).map((c, i) => (
            <View key={c.city} style={s.row}>
              <Text style={[s.rank, { color: theme.textMuted }]}>#{i + 1}</Text>
              <Ionicons name="location-outline" size={16} color="#3B82F6" />
              <Text style={[s.rowLabel, { color: theme.text }]}>{c.city}</Text>
              <View style={[s.bar, { backgroundColor: theme.surfaceAlt }]}>
                <View style={[s.barFill, { width: `${(c.clinics / maxCity) * 100}%`, backgroundColor: '#3B82F6' }]} />
              </View>
              <Text style={[s.rowValue, { color: theme.text }]}>{c.clinics}</Text>
              <Text style={[s.rowSub, { color: theme.textSecondary }]}>{c.rooms} stanze</Text>
            </View>
          ))
        )}
      </View>

      {/* Top specialties */}
      <View style={[s.section, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 16 }]}>
        <View style={s.head}>
          <View style={[s.dot, { backgroundColor: '#10B981' }]} />
          <Text style={[s.sectionTitle, { color: theme.text }]}>Top specialità (per medici)</Text>
        </View>
        {(data?.top_specialties || []).length === 0 ? (
          <Text style={[s.empty, { color: theme.textMuted }]}>Nessun medico registrato.</Text>
        ) : (
          (data?.top_specialties || []).map((sp, i) => (
            <View key={sp.specialty} style={s.row}>
              <Text style={[s.rank, { color: theme.textMuted }]}>#{i + 1}</Text>
              <Ionicons name="medkit-outline" size={16} color="#10B981" />
              <Text style={[s.rowLabel, { color: theme.text }]}>{cap(sp.specialty)}</Text>
              <View style={[s.bar, { backgroundColor: theme.surfaceAlt }]}>
                <View style={[s.barFill, { width: `${(sp.doctors / maxSpec) * 100}%`, backgroundColor: '#10B981' }]} />
              </View>
              <Text style={[s.rowValue, { color: theme.text }]}>{sp.doctors}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '900' },
  sub: { fontSize: 13, marginTop: 4, marginBottom: 18 },
  section: { padding: 18, borderRadius: 16, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sectionTitle: { fontSize: 15, fontWeight: '800', flex: 1 },
  totalText: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  rank: { fontSize: 11, fontWeight: '800', width: 22, fontVariant: ['tabular-nums'] as any },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { fontSize: 13, fontWeight: '600', minWidth: 100, flex: 1 },
  bar: { flex: 2, height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%' as any, borderRadius: 4 },
  rowValue: { fontSize: 14, fontWeight: '800', minWidth: 32, textAlign: 'right', fontVariant: ['tabular-nums'] as any },
  rowSub: { fontSize: 11, minWidth: 60, textAlign: 'right' },
  empty: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },
});
