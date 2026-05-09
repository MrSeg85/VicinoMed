import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/useTheme';
import { useAuth } from '../src/AuthContext';
import { api } from '../src/api';
import { formatDateLong, formatDateShort, formatTime, openExternal, whatsappLink, mapsLink } from '../src/utils';
import { specialtyLabel } from '../src/specialties';
import { AvailabilityManager } from '../src/components/AvailabilityManager';

interface Booking {
  booking_id: string;
  patient_name: string; patient_phone?: string;
  doctor_id: string; doctor_name: string;
  studio_id: string; studio_name: string; studio_address: string;
  studio_lat: number; studio_lng: number;
  specialty: string;
  datetime_iso: string;
  status: 'confermato' | 'cancellato' | 'completato';
  reason?: string;
}

const ITA_GREETING = (() => {
  const h = new Date().getHours();
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
})();

export default function DoctorDashboard() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [studios, setStudios] = useState<any[]>([]);
  const [studiosError, setStudiosError] = useState<string | null>(null);
  const [studiosLoading, setStudiosLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'agenda' | 'availability'>('agenda');

  const loadStudios = useCallback(async () => {
    setStudiosLoading(true);
    setStudiosError(null);
    try {
      const r = await api.get('/doctor/me');
      console.log('[DoctorDashboard] /doctor/me OK', { studios: r.data?.studios?.length });
      setStudios(r.data?.studios || []);
    } catch (e: any) {
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail;
      console.warn('[DoctorDashboard] /doctor/me FAILED', status, detail);
      if (status === 404) {
        setStudiosError("Il tuo profilo medico non è ancora attivato. Contatta il supporto VicinoMed per associare i tuoi studi.");
      } else if (status === 403) {
        setStudiosError("Solo gli account medico possono accedere a questa sezione.");
      } else {
        setStudiosError("Impossibile caricare i tuoi studi. Riprova.");
      }
      setStudios([]);
    } finally {
      setStudiosLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (user?.role !== 'doctor') { setLoading(false); return; }
    try {
      const bRes = await api.get('/doctor/bookings');
      setBookings(bRes.data);
    } catch (e) { console.warn('[DoctorDashboard] /doctor/bookings failed', e); }
    finally { setLoading(false); setRefreshing(false); }
    // Studios in parallel (independent failure)
    loadStudios();
  }, [user, loadStudios]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ───── Computed metrics ─────
  const metrics = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay); endOfDay.setDate(endOfDay.getDate() + 1);
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfDay.getDay() + 6) % 7)); // Lunedì
    const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(endOfWeek.getDate() + 7);

    const today: Booking[] = [];
    const upcoming: Booking[] = [];
    let thisWeek = 0;
    let completed = 0;
    let revenue = 0;       // stima: numero prenotazioni completate
    let nextUp: Booking | null = null;
    const uniquePatients = new Set<string>();

    bookings.forEach((b) => {
      uniquePatients.add(b.patient_name);
      const dt = new Date(b.datetime_iso);
      const isFuture = dt >= now;
      const isConfirmed = b.status === 'confermato';
      if (isConfirmed && dt >= startOfDay && dt < endOfDay) today.push(b);
      if (isConfirmed && isFuture) {
        upcoming.push(b);
        if (!nextUp || dt < new Date(nextUp.datetime_iso)) nextUp = b;
      }
      if (isConfirmed && dt >= startOfWeek && dt < endOfWeek) thisWeek += 1;
      if (b.status === 'completato' || (isConfirmed && dt < now)) {
        completed += 1;
        revenue += 100; // stima media 100€/visita (placeholder)
      }
    });

    today.sort((a, b) => a.datetime_iso.localeCompare(b.datetime_iso));
    upcoming.sort((a, b) => a.datetime_iso.localeCompare(b.datetime_iso));
    return { today, upcoming, thisWeek, completed, revenue, nextUp, totalPatients: uniquePatients.size };
  }, [bookings]);

  // ───── Guards ─────
  if (!user) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }
  if (user.role !== 'doctor') {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background, padding: 24 }]}>
        <Ionicons name="medkit-outline" size={56} color={theme.textMuted} />
        <Text style={[styles.guardTitle, { color: theme.text }]}>Area riservata ai medici</Text>
        <Text style={[styles.guardText, { color: theme.textSecondary }]}>
          Accedi con un account medico per vedere la dashboard.
        </Text>
        <TouchableOpacity
          testID="dash-go-home"
          style={[styles.btn, { backgroundColor: theme.primary, marginTop: 16 }]}
          onPress={() => router.replace('/(tabs)/home')}
        >
          <Text style={[styles.btnText, { color: theme.primaryFg }]}>Torna alla Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            {user.picture ? (
              <Image source={{ uri: user.picture }} style={{ width: 52, height: 52, borderRadius: 26 }} />
            ) : (
              <Text style={{ color: theme.primary, fontSize: 22, fontWeight: '800' }}>
                {user.name.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{ITA_GREETING},</Text>
            <Text style={styles.name} testID="dash-doctor-name">{user.name}</Text>
            <Text style={styles.dateText}>{formatDateLong(new Date())}</Text>
          </View>
          <TouchableOpacity
            testID="dash-logout"
            style={styles.logoutBtn}
            onPress={async () => { await logout(); router.replace('/auth/login'); }}
          >
            <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />}
      >
        {/* Tab switcher */}
        <View style={[styles.tabSwitcher, { backgroundColor: theme.surfaceAlt }]}>
          <TouchableOpacity
            testID="tab-agenda"
            style={[styles.tabBtn, tab === 'agenda' && { backgroundColor: theme.surface, ...styles.tabBtnActive }]}
            onPress={() => setTab('agenda')}
          >
            <Ionicons name="calendar" size={16} color={tab === 'agenda' ? theme.primary : theme.textSecondary} />
            <Text style={{ color: tab === 'agenda' ? theme.primary : theme.textSecondary, fontWeight: '700', fontSize: 13 }}>
              Agenda
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tab-availability"
            style={[styles.tabBtn, tab === 'availability' && { backgroundColor: theme.surface, ...styles.tabBtnActive }]}
            onPress={() => setTab('availability')}
          >
            <Ionicons name="time" size={16} color={tab === 'availability' ? theme.primary : theme.textSecondary} />
            <Text style={{ color: tab === 'availability' ? theme.primary : theme.textSecondary, fontWeight: '700', fontSize: 13 }}>
              Disponibilità
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'agenda' ? (
          <>
            {/* Next-up card */}
            {metrics.nextUp && (
              <NextUpCard theme={theme} booking={metrics.nextUp} />
            )}

            {/* Stats grid */}
            <View style={styles.statsGrid}>
              <StatCard theme={theme} label="Oggi" value={metrics.today.length.toString()} icon="today-outline" color={theme.primary} testID="stat-today" />
              <StatCard theme={theme} label="Settimana" value={metrics.thisWeek.toString()} icon="calendar-outline" color={theme.secondary} testID="stat-week" />
            </View>
            <View style={styles.statsGrid}>
              <StatCard theme={theme} label="Pazienti" value={metrics.totalPatients.toString()} icon="people-outline" color="#F59E0B" testID="stat-patients" />
              <StatCard theme={theme} label="Completate" value={metrics.completed.toString()} icon="checkmark-done-outline" color="#A855F7" testID="stat-completed" />
            </View>

            {/* Today's agenda */}
            <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.dot, { backgroundColor: theme.secondary }]} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Agenda di oggi</Text>
                </View>
                <Text style={[styles.sectionMeta, { color: theme.textMuted }]}>
                  {metrics.today.length} visit{metrics.today.length === 1 ? 'a' : 'e'}
                </Text>
              </View>

              {loading ? (
                <ActivityIndicator color={theme.primary} style={{ marginVertical: 24 }} />
              ) : metrics.today.length === 0 ? (
                <View style={styles.emptyTodaY}>
                  <Ionicons name="cafe-outline" size={42} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textSecondary, marginTop: 8 }]}>
                    Nessuna visita oggi. Goditi una giornata tranquilla ☕
                  </Text>
                </View>
              ) : (
                metrics.today.map((b, i) => (
                  <BookingRow key={b.booking_id} booking={b} theme={theme} isFirst={i === 0} />
                ))
              )}
            </View>

            {/* Upcoming */}
            <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Prossime visite</Text>
                <Text style={[styles.sectionMeta, { color: theme.textMuted }]}>
                  {metrics.upcoming.length} totali
                </Text>
              </View>
              {metrics.upcoming.length === 0 ? (
                <Text style={{ color: theme.textSecondary, textAlign: 'center', marginVertical: 24 }}>
                  Nessuna visita programmata.
                </Text>
              ) : (
                metrics.upcoming.slice(0, 8).map((b) => (
                  <BookingRow key={b.booking_id} booking={b} theme={theme} showDate />
                ))
              )}
            </View>
          </>
        ) : (
          /* Availability tab */
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Gestisci disponibilità</Text>
              </View>
            </View>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 12, lineHeight: 19 }}>
              Tocca uno slot per selezionarlo. Puoi <Text style={{ fontWeight: '700' }}>bloccare</Text> più slot insieme
              (es. quando sei in ferie, in sala operatoria o in trasferta).
              Gli slot bloccati non sono prenotabili dai pazienti.
            </Text>

            {studiosLoading ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <ActivityIndicator color={theme.primary} />
                <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 12 }}>
                  Caricamento studi...
                </Text>
              </View>
            ) : studiosError ? (
              <View style={[styles.errorCard, { borderColor: theme.warning, backgroundColor: theme.warning + '15' }]} testID="avail-error">
                <Ionicons name="alert-circle" size={28} color={theme.warning} />
                <Text style={[styles.errorTitle, { color: theme.text }]}>Profilo non disponibile</Text>
                <Text style={[styles.errorText, { color: theme.textSecondary }]}>{studiosError}</Text>
                <TouchableOpacity
                  testID="avail-retry"
                  style={[styles.retryBtn, { backgroundColor: theme.primary }]}
                  onPress={loadStudios}
                >
                  <Ionicons name="refresh" size={16} color={theme.primaryFg} />
                  <Text style={{ color: theme.primaryFg, fontWeight: '700', marginLeft: 6 }}>Riprova</Text>
                </TouchableOpacity>
              </View>
            ) : studios.length === 0 ? (
              <View style={[styles.errorCard, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
                <Ionicons name="business-outline" size={28} color={theme.textMuted} />
                <Text style={[styles.errorTitle, { color: theme.text }]}>Nessuno studio configurato</Text>
                <Text style={[styles.errorText, { color: theme.textSecondary }]}>
                  Aggiungi almeno uno studio per gestire la tua disponibilità.
                </Text>
              </View>
            ) : (
              <AvailabilityManager studios={studios} theme={theme} />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ───── Components ─────
function NextUpCard({ theme, booking }: { theme: any; booking: Booking }) {
  const dt = new Date(booking.datetime_iso);
  const minsToGo = Math.round((dt.getTime() - Date.now()) / 60000);
  const isSoon = minsToGo > 0 && minsToGo < 60;
  const subtitle = isSoon
    ? `Tra ${minsToGo} minut${minsToGo === 1 ? 'o' : 'i'}`
    : minsToGo < 0
      ? 'Visita in corso'
      : `${formatDateShort(dt)} · ${formatTime(dt)}`;

  return (
    <View style={[styles.nextUp, { backgroundColor: theme.secondary }]} testID="next-up-card">
      <View style={{ flex: 1 }}>
        <Text style={[styles.nextUpLabel, { color: theme.secondaryFg, opacity: 0.8 }]}>PROSSIMA VISITA</Text>
        <Text style={[styles.nextUpName, { color: theme.secondaryFg }]} numberOfLines={1}>
          {booking.patient_name}
        </Text>
        <Text style={[styles.nextUpSub, { color: theme.secondaryFg, opacity: 0.9 }]}>
          {subtitle} · {specialtyLabel(booking.specialty)}
        </Text>
        <Text style={[styles.nextUpStudio, { color: theme.secondaryFg, opacity: 0.75 }]} numberOfLines={1}>
          📍 {booking.studio_name}
        </Text>
      </View>
      {booking.patient_phone && (
        <TouchableOpacity
          testID="next-up-whatsapp"
          style={styles.nextUpWa}
          onPress={() => openExternal(whatsappLink(booking.patient_phone!, `Buongiorno ${booking.patient_name}, le confermo la visita di oggi alle ${formatTime(dt)} presso ${booking.studio_name}. A presto!`))}
        >
          <Ionicons name="logo-whatsapp" size={22} color={theme.secondaryFg} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function StatCard({ theme, label, value, icon, color, testID }: any) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]} testID={testID}>
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      </View>
    </View>
  );
}

function BookingRow({
  booking, theme, isFirst, showDate,
}: { booking: Booking; theme: any; isFirst?: boolean; showDate?: boolean }) {
  const dt = new Date(booking.datetime_iso);
  return (
    <View
      style={[
        styles.row,
        { borderTopColor: theme.border, borderTopWidth: isFirst ? 0 : 1 },
      ]}
      testID={`dash-row-${booking.booking_id}`}
    >
      <View style={[styles.timePill, { backgroundColor: theme.accent }]}>
        <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 12 }}>
          {formatTime(dt)}
        </Text>
        {showDate && (
          <Text style={{ color: theme.primary, fontSize: 9, fontWeight: '600', marginTop: 2 }}>
            {formatDateShort(dt).split(' ').slice(0, 2).join(' ')}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>
          {booking.patient_name}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
          {specialtyLabel(booking.specialty)} · {booking.studio_name}
        </Text>
        {booking.reason && (
          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2, fontStyle: 'italic' }} numberOfLines={1}>
            «{booking.reason}»
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {booking.patient_phone && (
          <TouchableOpacity
            testID={`dash-whatsapp-${booking.booking_id}`}
            style={[styles.iconBtn, { backgroundColor: theme.whatsapp + '22' }]}
            onPress={() => openExternal(whatsappLink(booking.patient_phone!, `Buongiorno ${booking.patient_name}, le confermo la visita di ${formatDateLong(dt)} alle ${formatTime(dt)} presso ${booking.studio_name}.`))}
          >
            <Ionicons name="logo-whatsapp" size={18} color={theme.whatsapp} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          testID={`dash-maps-${booking.booking_id}`}
          style={[styles.iconBtn, { backgroundColor: theme.primary + '22' }]}
          onPress={() => openExternal(mapsLink(booking.studio_lat, booking.studio_lng, booking.studio_name))}
        >
          <Ionicons name="navigate" size={16} color={theme.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  guardTitle: { fontSize: 18, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  guardText: { fontSize: 14, marginTop: 8, textAlign: 'center' },

  header: { padding: 20, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  greeting: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  name: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  dateText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' as any },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },

  nextUp: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, gap: 12 },
  nextUpLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  nextUpName: { fontSize: 22, fontWeight: '800', marginTop: 6 },
  nextUpSub: { fontSize: 13, marginTop: 4, fontWeight: '600' },
  nextUpStudio: { fontSize: 12, marginTop: 4 },
  nextUpWa: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },

  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, gap: 12 },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12 },

  section: { padding: 18, borderRadius: 20, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionMeta: { fontSize: 12, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  timePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, alignItems: 'center', minWidth: 56 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  emptyTodaY: { alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 13, textAlign: 'center' },
  btn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  btnText: { fontSize: 14, fontWeight: '700' },

  tabSwitcher: { flexDirection: 'row', padding: 4, borderRadius: 14, gap: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10 },
  tabBtnActive: {
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  errorCard: { padding: 22, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 8 },
  errorTitle: { fontSize: 16, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  errorText: { fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 320 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginTop: 8 },
});
