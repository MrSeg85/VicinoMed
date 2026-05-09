import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/useTheme';
import { useAuth } from '../src/AuthContext';
import { api } from '../src/api';
import { formatDateLong, formatTime, openExternal, whatsappLink } from '../src/utils';
import { specialtyLabel } from '../src/specialties';

export default function DoctorDashboard() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'doctor') {
      setLoading(false);
      return;
    }
    api.get('/doctor/bookings').then(r => setBookings(r.data)).catch(console.warn).finally(() => setLoading(false));
  }, [user]);

  if (user?.role !== 'doctor') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="medkit" size={48} color={theme.textMuted} />
        <Text style={{ color: theme.text, marginTop: 12, fontWeight: '700', fontSize: 18, textAlign: 'center' }}>
          Solo per i medici
        </Text>
        <Text style={{ color: theme.textSecondary, marginTop: 8, textAlign: 'center' }}>
          Accedi con un account medico per vedere la dashboard.
        </Text>
      </SafeAreaView>
    );
  }

  const upcoming = bookings.filter((b: any) => new Date(b.datetime_iso) >= new Date() && b.status === 'confermato');
  const today = upcoming.filter((b: any) => new Date(b.datetime_iso).toDateString() === new Date().toDateString());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => router.back()} testID="dash-back">
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Dashboard</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard theme={theme} label="Oggi" value={today.length.toString()} icon="today" color={theme.primary} />
          <StatCard theme={theme} label="In arrivo" value={upcoming.length.toString()} icon="calendar" color={theme.secondary} />
          <StatCard theme={theme} label="Totali" value={bookings.length.toString()} icon="people" color="#F59E0B" />
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Prossimi pazienti</Text>
          {loading ? (
            <ActivityIndicator color={theme.primary} style={{ marginVertical: 24 }} />
          ) : upcoming.length === 0 ? (
            <Text style={{ color: theme.textSecondary, textAlign: 'center', marginVertical: 24 }}>
              Nessuna visita programmata.
            </Text>
          ) : (
            upcoming.slice(0, 20).map((b: any) => {
              const dt = new Date(b.datetime_iso);
              return (
                <View key={b.booking_id} style={[styles.row, { borderTopColor: theme.border }]} testID={`dash-row-${b.booking_id}`}>
                  <View style={[styles.timePill, { backgroundColor: theme.accent }]}>
                    <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 11 }}>{formatTime(dt)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '700' }}>{b.patient_name}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                      {formatDateLong(dt)} · {specialtyLabel(b.specialty)} · {b.studio_name}
                    </Text>
                  </View>
                  {b.patient_phone && (
                    <TouchableOpacity
                      testID={`dash-whatsapp-${b.booking_id}`}
                      style={[styles.iconBtn, { backgroundColor: theme.whatsapp + '22' }]}
                      onPress={() => openExternal(whatsappLink(b.patient_phone, `Buongiorno ${b.patient_name}, le confermo la visita di ${formatDateLong(dt)} alle ${formatTime(dt)} presso ${b.studio_name}.`))}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color={theme.whatsapp} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ theme, label, value, icon, color }: any) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, alignItems: 'flex-start' },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  section: { padding: 18, borderRadius: 20, borderWidth: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, gap: 12 },
  timePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
