import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
  Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { useAuth } from '../../src/AuthContext';
import { api } from '../../src/api';
import { specialtyLabel } from '../../src/specialties';
import {
  next14Days, formatDay, formatDateLong, dateToIsoDate,
  combineDateAndTime, openExternal, mapsLink, formatDateShort,
} from '../../src/utils';

export default function DoctorProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const [doctor, setDoctor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [studioIdx, setStudioIdx] = useState(0);
  const days = next14Days();
  const [selectedDate, setSelectedDate] = useState<Date>(days[0]);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    api.get(`/doctors/${id}`).then(r => setDoctor(r.data)).catch(console.warn).finally(() => setLoading(false));
  }, [id]);

  const studio = doctor?.studios?.[studioIdx];

  const loadSlots = useCallback(async () => {
    if (!doctor || !studio) return;
    setLoadingSlots(true);
    setSelectedTime(null);
    try {
      const r = await api.get(`/doctors/${doctor.doctor_id}/availability`, {
        params: { studio_id: studio.studio_id, date: dateToIsoDate(selectedDate) },
      });
      setSlots(r.data.slots);
    } catch (e) { setSlots([]); }
    finally { setLoadingSlots(false); }
  }, [doctor, studio, selectedDate]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const onBook = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!selectedTime || !studio) return;
    setBooking(true);
    try {
      const dt = combineDateAndTime(selectedDate, selectedTime);
      const r = await api.post('/bookings', {
        doctor_id: doctor.doctor_id,
        studio_id: studio.studio_id,
        datetime_iso: dt,
      });
      router.replace(`/booking/${r.data.booking_id}`);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore nella prenotazione';
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Errore', msg);
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!doctor) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: theme.text }}>Medico non trovato</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
          {/* Header bar */}
          <View style={[styles.headerBar]}>
            <TouchableOpacity testID="back-button" onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="arrow-back" size={20} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="heart-outline" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <Image source={{ uri: doctor.photo }} style={styles.heroPhoto} />
            <View style={styles.heroInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.heroName, { color: theme.text }]}>{doctor.title} {doctor.name}</Text>
                {doctor.verified && (
                  <View style={[styles.verifiedBadge, { backgroundColor: theme.secondary }]}>
                    <Ionicons name="checkmark" size={12} color={theme.secondaryFg} />
                    <Text style={{ color: theme.secondaryFg, fontSize: 10, fontWeight: '700', marginLeft: 4 }}>VERIFICATO</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.heroSpec, { color: theme.textSecondary }]}>
                {doctor.specialties.map(specialtyLabel).join(' · ')}
              </Text>
              <View style={styles.heroStats}>
                <Stat theme={theme} icon="star" iconColor="#F59E0B" value={doctor.rating.toFixed(1)} label={`${doctor.reviews_count} recensioni`} />
                <Stat theme={theme} icon="time" iconColor={theme.primary} value={`${doctor.experience_years}+`} label="anni di esperienza" />
                <Stat theme={theme} icon="cash" iconColor={theme.secondary} value={`€${doctor.price_from}`} label="prima visita" />
              </View>
            </View>
          </View>

          {/* Bio */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Chi sono</Text>
            <Text style={[styles.bio, { color: theme.textSecondary }]}>{doctor.bio}</Text>
            <View style={styles.langRow}>
              <Ionicons name="globe-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.langText, { color: theme.textSecondary }]}>
                Lingue: {doctor.languages.join(', ')}
              </Text>
            </View>
          </View>

          {/* Studios */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Studi medici</Text>
            {doctor.studios.map((s: any, i: number) => (
              <TouchableOpacity
                key={s.studio_id}
                testID={`studio-${i}`}
                style={[
                  styles.studioCard,
                  { borderColor: theme.border, backgroundColor: i === studioIdx ? theme.accent : theme.surfaceAlt },
                  i === studioIdx && { borderColor: theme.primary },
                ]}
                onPress={() => setStudioIdx(i)}
              >
                <View style={[styles.studioRadio, { borderColor: i === studioIdx ? theme.primary : theme.border }]}>
                  {i === studioIdx && <View style={[styles.studioDot, { backgroundColor: theme.primary }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.studioName, { color: theme.text }]}>{s.name}</Text>
                  <Text style={[styles.studioAddress, { color: theme.textSecondary }]}>
                    {s.address}, {s.city} ({s.postal_code})
                  </Text>
                </View>
                <TouchableOpacity onPress={() => openExternal(mapsLink(s.lat, s.lng, s.name))}>
                  <Ionicons name="navigate" size={20} color={theme.primary} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>

          {/* Calendar */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Disponibilità</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {days.map((d, i) => {
                const active = dateToIsoDate(d) === dateToIsoDate(selectedDate);
                return (
                  <TouchableOpacity
                    key={i}
                    testID={`day-${i}`}
                    style={[
                      styles.dayCard,
                      { borderColor: theme.border, backgroundColor: active ? theme.primary : theme.surfaceAlt },
                    ]}
                    onPress={() => setSelectedDate(d)}
                  >
                    <Text style={{ color: active ? theme.primaryFg : theme.textSecondary, fontSize: 11, fontWeight: '600' }}>
                      {formatDay(d).split(' ')[0]}
                    </Text>
                    <Text style={{ color: active ? theme.primaryFg : theme.text, fontSize: 18, fontWeight: '700', marginTop: 2 }}>
                      {d.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>
              {formatDateLong(selectedDate)}
            </Text>

            {loadingSlots ? (
              <ActivityIndicator color={theme.primary} style={{ marginTop: 16 }} />
            ) : slots.length === 0 ? (
              <Text style={[styles.noSlots, { color: theme.textMuted }]}>Nessuna disponibilità in questa data.</Text>
            ) : (
              <View style={styles.slotsGrid}>
                {slots.map((t) => {
                  const active = selectedTime === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      testID={`slot-${t}`}
                      style={[
                        styles.slot,
                        { borderColor: theme.border, backgroundColor: active ? theme.primary : theme.surfaceAlt },
                      ]}
                      onPress={() => setSelectedTime(t)}
                    >
                      <Text style={{ color: active ? theme.primaryFg : theme.text, fontWeight: '600', fontSize: 14 }}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Reviews */}
          {doctor.reviews?.length > 0 && (
            <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Recensioni ({doctor.reviews_count})</Text>
              {doctor.reviews.slice(0, 5).map((r: any) => (
                <View key={r.review_id} style={[styles.reviewItem, { borderTopColor: theme.border }]}>
                  <View style={styles.reviewHeader}>
                    <Text style={{ color: theme.text, fontWeight: '700' }}>{r.patient_name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <Ionicons key={n} name={n <= r.rating ? 'star' : 'star-outline'} size={12} color="#F59E0B" />
                      ))}
                    </View>
                  </View>
                  <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{r.comment}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Sticky CTA */}
        <View style={[styles.cta, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.ctaLabel, { color: theme.textSecondary }]}>
              {selectedTime ? `${formatDateShort(selectedDate)} alle ${selectedTime}` : 'Seleziona un orario'}
            </Text>
            <Text style={[styles.ctaPrice, { color: theme.text }]}>
              da €{doctor.price_from}
            </Text>
          </View>
          <TouchableOpacity
            testID="book-button"
            style={[
              styles.ctaBtn,
              { backgroundColor: selectedTime ? theme.primary : theme.surfaceAlt },
            ]}
            onPress={onBook}
            disabled={!selectedTime || booking}
          >
            {booking ? (
              <ActivityIndicator color={theme.primaryFg} />
            ) : (
              <>
                <Text style={[styles.ctaBtnText, { color: selectedTime ? theme.primaryFg : theme.textMuted }]}>
                  Prenota visita
                </Text>
                <Ionicons name="arrow-forward" size={18} color={selectedTime ? theme.primaryFg : theme.textMuted} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Stat({ theme, icon, iconColor, value, label }: any) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={16} color={iconColor} />
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15, marginTop: 4 }}>{value}</Text>
      <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', padding: 20, gap: 16, alignItems: 'flex-start' },
  heroPhoto: { width: 100, height: 100, borderRadius: 24, backgroundColor: '#E2E8F0' },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 20, fontWeight: '700', flexShrink: 1 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, marginLeft: 8 },
  heroSpec: { fontSize: 13, marginTop: 4 },
  heroStats: { flexDirection: 'row', gap: 12, marginTop: 12 },
  stat: { flex: 1, alignItems: 'center' },

  section: { margin: 16, marginTop: 0, marginBottom: 12, padding: 18, borderRadius: 20, borderWidth: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  bio: { fontSize: 14, lineHeight: 21 },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  langText: { fontSize: 13 },

  studioCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8, gap: 12 },
  studioRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  studioDot: { width: 10, height: 10, borderRadius: 5 },
  studioName: { fontSize: 14, fontWeight: '700' },
  studioAddress: { fontSize: 12, marginTop: 2 },

  dayCard: { width: 56, paddingVertical: 12, alignItems: 'center', borderRadius: 14, borderWidth: 1 },
  dateLabel: { fontSize: 13, marginTop: 16, fontWeight: '600', textTransform: 'capitalize' as any },
  noSlots: { fontSize: 13, fontStyle: 'italic', marginTop: 12 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  slot: { width: 76, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1 },

  reviewItem: { paddingVertical: 12, borderTopWidth: 1 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  cta: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1, gap: 12,
  },
  ctaLabel: { fontSize: 12 },
  ctaPrice: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, height: 56, borderRadius: 16 },
  ctaBtnText: { fontSize: 15, fontWeight: '700' },
});
