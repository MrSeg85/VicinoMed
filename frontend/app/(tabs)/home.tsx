import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl,
  Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { useAuth } from '../../src/AuthContext';
import { api } from '../../src/api';
import { specialtyIcon, specialtyLabel } from '../../src/specialties';

interface Specialty { id: string; name: string }
interface Doctor {
  doctor_id: string; name: string; title: string; specialties: string[];
  photo: string; rating: number; reviews_count: number; price_from: number;
  verified: boolean; studios: any[];
}

export default function Home() {
  const theme = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [city, setCity] = useState<string>('Roma');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([
        api.get('/specialties'),
        api.get('/doctors', { params: { limit: 20 } }),
      ]);
      setSpecialties(s.data);
      setDoctors(d.data);
    } catch (e) {
      console.warn('home load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (Platform.OS !== 'web') {
      // try to resolve city via expo-location
      (async () => {
        try {
          const Location = await import('expo-location');
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') return;
          const pos = await Location.getCurrentPositionAsync({});
          const places = await Location.reverseGeocodeAsync(pos.coords);
          if (places && places[0]?.city) setCity(places[0].city);
        } catch {}
      })();
    } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => {/* keep default city */});
    }
  }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>Ciao{user ? `, ${user.name.split(' ')[0]}` : ''} 👋</Text>
            <View style={styles.locRow}>
              <Ionicons name="location" size={16} color={theme.primary} />
              <Text style={[styles.location, { color: theme.text }]} testID="home-city">{city}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.avatar, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
            onPress={() => router.push('/(tabs)/profile')}
            testID="home-avatar"
          >
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Ionicons name="person" size={22} color={theme.textSecondary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={styles.heroWrap}>
          <View style={[styles.hero, { backgroundColor: theme.primary }]}>
            <Text style={[styles.heroTag, { color: theme.primaryFg, opacity: 0.85 }]}>VICINOMED</Text>
            <Text style={[styles.heroTitle, { color: theme.primaryFg }]}>
              La visita specialistica più vicina a te.
            </Text>
            <TouchableOpacity
              style={[styles.heroCta, { backgroundColor: theme.secondary }]}
              onPress={() => router.push('/(tabs)/search')}
              testID="home-hero-cta"
            >
              <Ionicons name="search" size={18} color={theme.secondaryFg} />
              <Text style={[styles.heroCtaText, { color: theme.secondaryFg }]}>Trova un medico</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <QuickAction theme={theme} icon="flash" label="Visita oggi" onPress={() => router.push({ pathname: '/(tabs)/search', params: { q: 'oggi' } })} testID="qa-today" />
          <QuickAction theme={theme} icon="map" label="Vicino a te" onPress={() => router.push({ pathname: '/(tabs)/search', params: { view: 'map' } })} testID="qa-map" />
          <QuickAction theme={theme} icon="star" label="Top medici" onPress={() => router.push({ pathname: '/(tabs)/search', params: { sort: 'rating' } })} testID="qa-top" />
        </View>

        {/* Specialties */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Specializzazioni</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/search')}>
            <Text style={{ color: theme.primary, fontWeight: '600' }}>Vedi tutte</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {specialties.map((s) => (
            <TouchableOpacity
              key={s.id}
              testID={`specialty-${s.id}`}
              style={[styles.specCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push({ pathname: '/(tabs)/search', params: { specialty: s.id } })}
            >
              <View style={[styles.specIcon, { backgroundColor: theme.accent }]}>
                <Ionicons name={specialtyIcon(s.id) as any} size={24} color={theme.primary} />
              </View>
              <Text style={[styles.specName, { color: theme.text }]} numberOfLines={2}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Featured doctors */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Medici consigliati</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginVertical: 32 }} />
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 14 }}>
            {doctors.slice(0, 8).map((d) => (
              <DoctorCard key={d.doctor_id} doctor={d} theme={theme} onPress={() => router.push(`/doctor/${d.doctor_id}`)} />
            ))}
          </View>
        )}

        <View style={[styles.trust, { backgroundColor: theme.accent, borderColor: theme.border }]}>
          <Ionicons name="shield-checkmark" size={28} color={theme.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.trustTitle, { color: theme.text }]}>Specialisti verificati</Text>
            <Text style={[styles.trustSub, { color: theme.textSecondary }]}>
              Ogni medico è certificato e accreditato presso l&apos;Ordine.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ theme, icon, label, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={[styles.qa, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={onPress}>
      <View style={[styles.qaIcon, { backgroundColor: theme.accent }]}>
        <Ionicons name={icon} size={20} color={theme.primary} />
      </View>
      <Text style={[styles.qaLabel, { color: theme.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function DoctorCard({ doctor, theme, onPress }: { doctor: Doctor; theme: any; onPress: () => void }) {
  const studio = doctor.studios?.[0];
  return (
    <TouchableOpacity
      testID={`doctor-card-${doctor.doctor_id}`}
      onPress={onPress}
      style={[styles.docCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      activeOpacity={0.9}
    >
      <Image source={{ uri: doctor.photo }} style={styles.docPhoto} />
      <View style={{ flex: 1 }}>
        <View style={styles.docNameRow}>
          <Text style={[styles.docName, { color: theme.text }]} numberOfLines={1}>
            {doctor.title} {doctor.name}
          </Text>
          {doctor.verified && (
            <Ionicons name="checkmark-circle" size={16} color={theme.secondary} style={{ marginLeft: 6 }} />
          )}
        </View>
        <Text style={[styles.docSpec, { color: theme.textSecondary }]} numberOfLines={1}>
          {doctor.specialties.map(specialtyLabel).join(' · ')}
        </Text>
        {studio && (
          <View style={styles.docMeta}>
            <Ionicons name="location-outline" size={14} color={theme.textMuted} />
            <Text style={[styles.docMetaText, { color: theme.textMuted }]} numberOfLines={1}>
              {studio.city}
            </Text>
          </View>
        )}
        <View style={styles.docFooter}>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={[styles.ratingText, { color: theme.text }]}>
              {doctor.rating.toFixed(1)}
            </Text>
            <Text style={[styles.reviewsText, { color: theme.textMuted }]}>
              ({doctor.reviews_count})
            </Text>
          </View>
          <Text style={[styles.price, { color: theme.primary }]}>da €{doctor.price_from}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1,
  },
  greeting: { fontSize: 13, fontWeight: '500' },
  locRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  location: { fontSize: 18, fontWeight: '700' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1 },

  heroWrap: { paddingHorizontal: 16, paddingTop: 16 },
  hero: { padding: 24, borderRadius: 24, position: 'relative', overflow: 'hidden' },
  heroTag: { fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 8 },
  heroTitle: { fontSize: 22, fontWeight: '700', lineHeight: 30, marginBottom: 16, maxWidth: 320 },
  heroCta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999 },
  heroCtaText: { fontSize: 14, fontWeight: '700' },

  quickRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 16, gap: 10 },
  qa: { flex: 1, paddingVertical: 16, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  qaIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  qaLabel: { fontSize: 12, fontWeight: '600' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },

  specCard: { width: 110, padding: 16, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  specIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  specName: { fontSize: 13, fontWeight: '600', textAlign: 'center' },

  docCard: { flexDirection: 'row', padding: 14, borderRadius: 20, borderWidth: 1, gap: 14, alignItems: 'center' },
  docPhoto: { width: 72, height: 72, borderRadius: 16, backgroundColor: '#E2E8F0' },
  docNameRow: { flexDirection: 'row', alignItems: 'center' },
  docName: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  docSpec: { fontSize: 13, marginTop: 2 },
  docMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  docMetaText: { fontSize: 12 },
  docFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '700' },
  reviewsText: { fontSize: 12 },
  price: { fontSize: 13, fontWeight: '700' },

  trust: { marginTop: 24, marginHorizontal: 16, padding: 16, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  trustTitle: { fontSize: 14, fontWeight: '700' },
  trustSub: { fontSize: 12, marginTop: 2 },
});
