import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { useAuth } from '../../src/AuthContext';
import { api } from '../../src/api';
import { formatDateLong, formatTime, openExternal, whatsappLink, mapsLink } from '../../src/utils';
import { specialtyLabel } from '../../src/specialties';

interface Booking {
  booking_id: string; doctor_name: string; doctor_phone?: string;
  studio_name: string; studio_address: string; studio_lat: number; studio_lng: number;
  specialty: string; datetime_iso: string; status: 'confermato' | 'cancellato' | 'completato';
  reason?: string;
}

export default function Appointments() {
  const theme = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const r = await api.get('/bookings/me');
      setBookings(r.data);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancel = async (b: Booking) => {
    const confirm = () => api.patch(`/bookings/${b.booking_id}/cancel`).then(load).catch(() => {});
    if (typeof window !== 'undefined' && window.confirm) {
      if (window.confirm('Vuoi annullare questa visita?')) confirm();
    } else {
      Alert.alert('Annulla visita', 'Vuoi annullare questa visita?', [
        { text: 'No', style: 'cancel' },
        { text: 'Sì, annulla', style: 'destructive', onPress: confirm },
      ]);
    }
  };

  const now = Date.now();
  const filtered = bookings.filter(b => {
    const dt = new Date(b.datetime_iso).getTime();
    if (tab === 'upcoming') return b.status === 'confermato' && dt >= now - 60 * 60 * 1000;
    return b.status !== 'confermato' || dt < now - 60 * 60 * 1000;
  });

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Ionicons name="lock-closed" size={48} color={theme.textMuted} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Accedi per vedere le tue visite</Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary, marginTop: 16 }]} onPress={() => router.push('/auth/login')}>
          <Text style={[styles.btnText, { color: theme.primaryFg }]}>Accedi</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>Le mie visite</Text>
        <View style={[styles.tabs, { backgroundColor: theme.surfaceAlt }]}>
          <TouchableOpacity
            testID="tab-upcoming"
            style={[styles.tab, tab === 'upcoming' && { backgroundColor: theme.primary }]}
            onPress={() => setTab('upcoming')}
          >
            <Text style={{ color: tab === 'upcoming' ? theme.primaryFg : theme.text, fontWeight: '600' }}>In arrivo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tab-past"
            style={[styles.tab, tab === 'past' && { backgroundColor: theme.primary }]}
            onPress={() => setTab('past')}
          >
            <Text style={{ color: tab === 'past' ? theme.primaryFg : theme.text, fontWeight: '600' }}>Storico</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={56} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {tab === 'upcoming' ? 'Nessuna visita in arrivo' : 'Nessuna visita passata'}
              </Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {tab === 'upcoming' ? 'Trova uno specialista e prenota in pochi tap.' : 'Le tue visite passate appariranno qui.'}
              </Text>
              {tab === 'upcoming' && (
                <TouchableOpacity style={[styles.btn, { backgroundColor: theme.primary, marginTop: 12 }]} onPress={() => router.push('/(tabs)/search')}>
                  <Text style={[styles.btnText, { color: theme.primaryFg }]}>Trova un medico</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filtered.map((b) => {
              const dt = new Date(b.datetime_iso);
              const cancelled = b.status === 'cancellato';
              return (
                <View key={b.booking_id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]} testID={`booking-${b.booking_id}`}>
                  <View style={styles.cardTop}>
                    <View style={[styles.specPill, { backgroundColor: theme.accent }]}>
                      <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 12 }}>
                        {specialtyLabel(b.specialty)}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: cancelled ? theme.error + '22' : theme.secondary + '22' }]}>
                      <Text style={{ color: cancelled ? theme.error : theme.secondary, fontWeight: '700', fontSize: 11, textTransform: 'uppercase' }}>
                        {b.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.docName, { color: theme.text }]}>{b.doctor_name}</Text>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar" size={16} color={theme.primary} />
                    <Text style={[styles.metaText, { color: theme.text }]}>{formatDateLong(dt)} · {formatTime(dt)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="location" size={16} color={theme.primary} />
                    <Text style={[styles.metaText, { color: theme.text }]}>{b.studio_name} — {b.studio_address}</Text>
                  </View>

                  {!cancelled && tab === 'upcoming' && (
                    <View style={styles.actions}>
                      <ActionBtn theme={theme} testID={`action-maps-${b.booking_id}`} icon="navigate" label="Indicazioni" onPress={() => openExternal(mapsLink(b.studio_lat, b.studio_lng, b.studio_name))} />
                      {b.doctor_phone && (
                        <ActionBtn
                          theme={theme}
                          testID={`action-whatsapp-${b.booking_id}`}
                          icon="logo-whatsapp"
                          color={theme.whatsapp}
                          label="WhatsApp"
                          onPress={() => openExternal(whatsappLink(b.doctor_phone!, `Buongiorno, sono ${user.name}. Le scrivo riguardo la mia visita di ${specialtyLabel(b.specialty)} prenotata per ${formatDateLong(dt)} alle ${formatTime(dt)}. Grazie.`))}
                        />
                      )}
                      <ActionBtn theme={theme} testID={`action-cancel-${b.booking_id}`} icon="close-circle" color={theme.error} label="Disdici" onPress={() => cancel(b)} />
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ActionBtn({ theme, icon, label, onPress, color, testID }: any) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={[styles.actBtn, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
      <Ionicons name={icon} size={16} color={color || theme.primary} />
      <Text style={[styles.actText, { color: color || theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, gap: 14 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 14 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
  card: { padding: 18, borderRadius: 20, borderWidth: 1, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  specPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  docName: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  metaText: { fontSize: 13, flex: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  actText: { fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8, marginTop: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  btn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  btnText: { fontSize: 14, fontWeight: '700' },
});
