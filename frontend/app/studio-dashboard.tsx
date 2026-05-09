import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/useTheme';
import { useAuth } from '../src/AuthContext';
import { api } from '../src/api';
import { openExternal, mapsLink, whatsappLink } from '../src/utils';

interface Clinic {
  clinic_id: string;
  owner_email: string;
  name: string;
  description: string;
  address: string;
  city: string;
  postal_code?: string;
  lat: number;
  lng: number;
  phone: string;
  whatsapp?: string;
  rooms_count: number;
  rooms: any[];
  photo?: string | null;
  verified: boolean;
}

const ITA_GREETING = (() => {
  const h = new Date().getHours();
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
})();

export default function StudioDashboard() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (user?.role !== 'studio') { setLoading(false); return; }
    setError(null);
    try {
      const r = await api.get('/studio/me');
      setClinic(r.data);
    } catch (e: any) {
      const status = e?.response?.status;
      console.warn('[StudioDashboard] /studio/me FAILED', status);
      if (status === 403) setError('Solo gli account studio possono accedere a questa sezione.');
      else setError('Impossibile caricare il profilo dello studio. Riprova.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (user && user.role !== 'studio') {
      // Wrong role landed here, redirect home
      router.replace('/(tabs)/home' as any);
    }
  }, [user, router]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const profileComplete = !!(clinic && clinic.address && clinic.city && clinic.lat && clinic.lng);

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>{ITA_GREETING},</Text>
            <Text style={[styles.brand, { color: theme.text }]} numberOfLines={1}>
              {clinic?.name || user?.name || 'Il tuo Studio'}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: theme.accent, borderColor: theme.primary }]}>
                <Ionicons name="business-outline" size={12} color={theme.primary} />
                <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '700', marginLeft: 4 }}>
                  STUDIO
                </Text>
              </View>
              {clinic?.verified && (
                <View style={[styles.badge, { backgroundColor: theme.success, borderColor: theme.success }]}>
                  <Ionicons name="checkmark-circle" size={12} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700', marginLeft: 4 }}>VERIFICATO</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={logout} style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="log-out-outline" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>

        {error && (
          <View style={[styles.errorCard, { backgroundColor: theme.surface, borderColor: theme.error }]}>
            <Ionicons name="alert-circle" size={22} color={theme.error} />
            <Text style={{ color: theme.error, flex: 1, marginLeft: 10 }}>{error}</Text>
          </View>
        )}

        {/* Profile completion alert */}
        {clinic && !profileComplete && (
          <View style={[styles.alert, { backgroundColor: theme.accent, borderColor: theme.primary }]}>
            <Ionicons name="information-circle" size={22} color={theme.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: theme.primary, fontWeight: '800', marginBottom: 2 }}>
                Completa il profilo dello studio
              </Text>
              <Text style={{ color: theme.text, fontSize: 13, lineHeight: 18 }}>
                Aggiungi indirizzo e geolocalizzazione per essere visibile ai medici.
              </Text>
            </View>
          </View>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="bed-outline" size={22} color={theme.primary} />
            <Text style={[styles.statValue, { color: theme.text }]}>{clinic?.rooms_count ?? 0}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Stanze totali</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="checkmark-done-outline" size={22} color={theme.secondary} />
            <Text style={[styles.statValue, { color: theme.text }]}>{clinic?.rooms?.length ?? 0}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Stanze configurate</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="people-outline" size={22} color={theme.warning} />
            <Text style={[styles.statValue, { color: theme.text }]}>0</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Medici attivi</Text>
          </View>
        </View>

        {/* Address card */}
        {clinic && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="location-outline" size={20} color={theme.primary} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>Sede</Text>
            </View>
            <Text style={[styles.addressText, { color: theme.text }]}>
              {clinic.address || '—'}
            </Text>
            <Text style={[styles.addressSub, { color: theme.textSecondary }]}>
              {[clinic.postal_code, clinic.city].filter(Boolean).join(' ') || 'Indirizzo non impostato'}
            </Text>
            {!!clinic.description && (
              <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={3}>
                {clinic.description}
              </Text>
            )}
            <View style={styles.actionRow}>
              {clinic.lat !== 0 && clinic.lng !== 0 && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                  onPress={() => openExternal(mapsLink(clinic.lat, clinic.lng, clinic.name))}
                >
                  <Ionicons name="map-outline" size={16} color={theme.text} />
                  <Text style={[styles.actionText, { color: theme.text }]}>Mappa</Text>
                </TouchableOpacity>
              )}
              {!!clinic.phone && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.whatsapp, borderColor: theme.whatsapp }]}
                  onPress={() => openExternal(whatsappLink(clinic.whatsapp || clinic.phone, `Ciao da ${clinic.name}`))}
                >
                  <Ionicons name="logo-whatsapp" size={16} color="#FFF" />
                  <Text style={[styles.actionText, { color: '#FFF' }]}>WhatsApp</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Rooms placeholder (Phase 2) */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="bed-outline" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Le tue stanze</Text>
          </View>
          {clinic?.rooms?.length ? (
            clinic.rooms.map((room: any, idx: number) => (
              <View key={idx} style={[styles.roomRow, { borderColor: theme.border }]}>
                <Text style={[styles.roomName, { color: theme.text }]}>{room.name || `Stanza ${idx + 1}`}</Text>
                <Text style={[styles.roomMeta, { color: theme.textSecondary }]}>
                  {room.equipment?.join(', ') || 'Nessuna attrezzatura'}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="layers-outline" size={42} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Nessuna stanza configurata</Text>
              <Text style={[styles.emptyMsg, { color: theme.textSecondary }]}>
                Aggiungi le stanze del tuo studio per renderle disponibili ai medici. Disponibile a breve.
              </Text>
              <View style={[styles.comingSoon, { backgroundColor: theme.accent, borderColor: theme.primary }]}>
                <Ionicons name="construct-outline" size={14} color={theme.primary} />
                <Text style={{ color: theme.primary, fontWeight: '700', marginLeft: 6, fontSize: 12 }}>
                  IN ARRIVO — FASE 2
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Quick actions */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="settings-outline" size={20} color={theme.primary} />
            <Text style={[styles.cardTitle, { color: theme.text }]}>Azioni rapide</Text>
          </View>
          <TouchableOpacity
            style={[styles.actionListItem, { borderColor: theme.border }]}
            onPress={() => router.push('/studio/profile' as any)}
          >
            <Ionicons name="create-outline" size={20} color={theme.text} />
            <Text style={[styles.actionListText, { color: theme.text }]}>Modifica profilo studio</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionListItem, { borderColor: theme.border }]}
            onPress={() => router.push('/studio/rooms' as any)}
          >
            <Ionicons name="bed-outline" size={20} color={theme.text} />
            <Text style={[styles.actionListText, { color: theme.text }]}>Gestisci stanze</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>
          <View style={[styles.actionListItem, { borderColor: theme.border, opacity: 0.5, borderBottomWidth: 0 }]}>
            <Ionicons name="cash-outline" size={20} color={theme.text} />
            <Text style={[styles.actionListText, { color: theme.text }]}>Tariffe & disponibilità</Text>
            <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700' }}>PROSSIMAMENTE</Text>
          </View>
        </View>

        <Text style={[styles.footer, { color: theme.textMuted }]}>
          VicinoMed Studio · v1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 13, fontWeight: '600' },
  brand: { fontSize: 24, fontWeight: '800', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 999, borderWidth: 1,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', marginLeft: 10,
  },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 14, borderWidth: 1, marginBottom: 16,
  },
  alert: {
    flexDirection: 'row', alignItems: 'flex-start', padding: 14,
    borderRadius: 14, borderWidth: 1, marginBottom: 16,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  statCard: {
    flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, alignItems: 'flex-start',
  },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 8 },
  statLabel: { fontSize: 11, marginTop: 2 },
  card: { padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  addressText: { fontSize: 15, fontWeight: '600' },
  addressSub: { fontSize: 13, marginTop: 2 },
  description: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 38, borderRadius: 10, borderWidth: 1,
  },
  actionText: { fontSize: 13, fontWeight: '700' },
  roomRow: { paddingVertical: 12, borderBottomWidth: 1 },
  roomName: { fontSize: 15, fontWeight: '700' },
  roomMeta: { fontSize: 13, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 10 },
  emptyMsg: { fontSize: 13, textAlign: 'center', marginTop: 4, marginHorizontal: 16, lineHeight: 19 },
  comingSoon: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 999, borderWidth: 1, marginTop: 14,
  },
  actionListItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1,
  },
  actionListText: { flex: 1, fontSize: 15, fontWeight: '600' },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 16 },
});
