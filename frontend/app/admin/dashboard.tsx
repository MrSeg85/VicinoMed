import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useTheme } from '../../src/useTheme';

interface AdminStats {
  users: {
    total: number; patient: number; doctor: number; studio: number; admin: number;
    suspended: number; verified_doctors: number;
  };
  doctors_profiles: number;
  clinics: number;
  bookings: { today: number; month: number; total: number };
  room_requests: {
    pending: number; total: number;
    accepted_volume_month: number; platform_revenue_month: number; platform_fee_pct: number;
  };
  reviews_total: number;
  generated_at: string;
}

export default function AdminDashboard() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/admin/stats');
      setStats(r.data);
      setError(null);
    } catch (e: any) {
      console.warn('[AdminDashboard] load fail', e?.response?.status, e?.message);
      setError('Impossibile caricare le statistiche.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: isWide ? 32 : 16, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
    >
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Dashboard</Text>
          <Text style={[styles.pageSub, { color: theme.textSecondary }]}>
            Panoramica della piattaforma VicinoMed
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.refreshBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => { setRefreshing(true); load(); }}
        >
          <Ionicons name="refresh" size={16} color={theme.text} />
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700', marginLeft: 6 }}>Aggiorna</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: theme.surface, borderColor: theme.error }]}>
          <Ionicons name="alert-circle" size={20} color={theme.error} />
          <Text style={{ color: theme.error, marginLeft: 10, flex: 1 }}>{error}</Text>
        </View>
      )}

      {stats && (
        <>
          {/* HERO STATS - 4 big cards */}
          <View style={styles.heroGrid}>
            <BigStat
              theme={theme}
              icon="people"
              accent="#3B82F6"
              label="Utenti totali"
              value={stats.users.total.toString()}
              breakdown={[
                { label: 'Pazienti', value: stats.users.patient, color: '#06B6D4' },
                { label: 'Medici', value: stats.users.doctor, color: '#10B981' },
                { label: 'Studi', value: stats.users.studio, color: '#8B5CF6' },
              ]}
              wide={isWide}
              onPress={() => router.push('/admin/users' as any)}
            />
            <BigStat
              theme={theme}
              icon="calendar"
              accent="#10B981"
              label="Prenotazioni"
              value={stats.bookings.month.toString()}
              breakdown={[
                { label: 'Oggi', value: stats.bookings.today, color: '#3B82F6' },
                { label: 'Mese', value: stats.bookings.month, color: '#10B981' },
                { label: 'Totali', value: stats.bookings.total, color: theme.textSecondary },
              ]}
              wide={isWide}
            />
            <BigStat
              theme={theme}
              icon="trending-up"
              accent="#F59E0B"
              label="Volume affitti (mese)"
              value={`\u20ac${stats.room_requests.accepted_volume_month.toFixed(0)}`}
              caption={`Commissione ${stats.room_requests.platform_fee_pct}%: \u20ac${stats.room_requests.platform_revenue_month.toFixed(2)}`}
              wide={isWide}
              onPress={() => router.push('/admin/settings' as any)}
            />
            <BigStat
              theme={theme}
              icon="mail-unread"
              accent="#EF4444"
              label="Richieste pending"
              value={stats.room_requests.pending.toString()}
              caption={`${stats.room_requests.total} totali nel sistema`}
              wide={isWide}
              showBadge={stats.room_requests.pending > 0}
            />
          </View>

          {/* TWO-COLUMN: User breakdown + Quick info */}
          <View style={[styles.row, !isWide && styles.rowMobile]}>
            <View style={[styles.col, !isWide && styles.colMobile]}>
              <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.sectionHead}>
                  <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Distribuzione utenti</Text>
                </View>
                <UserRow theme={theme} icon="person-outline" color="#06B6D4" label="Pazienti" value={stats.users.patient} total={stats.users.total} />
                <UserRow theme={theme} icon="medical-outline" color="#10B981" label="Medici" value={stats.users.doctor} total={stats.users.total} />
                <UserRow theme={theme} icon="business-outline" color="#8B5CF6" label="Studi" value={stats.users.studio} total={stats.users.total} />
                <UserRow theme={theme} icon="shield-checkmark-outline" color="#0A3D62" label="Admin" value={stats.users.admin} total={stats.users.total} />
                {stats.users.suspended > 0 && (
                  <View style={[styles.alertBox, { backgroundColor: `${theme.error}15`, borderColor: theme.error }]}>
                    <Ionicons name="warning" size={14} color={theme.error} />
                    <Text style={{ color: theme.error, fontSize: 12, marginLeft: 6, fontWeight: '600' }}>
                      {stats.users.suspended} {stats.users.suspended === 1 ? 'account sospeso' : 'account sospesi'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={[styles.col, !isWide && styles.colMobile]}>
              <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.sectionHead}>
                  <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Catalogo</Text>
                </View>
                <CatalogRow theme={theme} icon="medkit-outline" label="Profili medici" value={stats.doctors_profiles} caption={`di cui ${stats.users.verified_doctors} verificati`} />
                <CatalogRow theme={theme} icon="business-outline" label="Studi medici" value={stats.clinics} />
                <CatalogRow theme={theme} icon="star-outline" label="Recensioni" value={stats.reviews_total} />
              </View>
            </View>
          </View>

          {/* QUICK ACTIONS */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 16 }]}>
            <View style={styles.sectionHead}>
              <View style={[styles.dot, { backgroundColor: theme.primary }]} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Azioni rapide</Text>
            </View>
            <View style={[styles.actionGrid, !isWide && styles.actionGridMobile]}>
              <ActionTile theme={theme} icon="people" label="Gestisci utenti" caption="Verifica, sospendi, elimina" onPress={() => router.push('/admin/users' as any)} />
              <ActionTile theme={theme} icon="business" label="Studi" caption="Lista cliniche e stanze" onPress={() => router.push('/admin/clinics' as any)} />
              <ActionTile theme={theme} icon="bar-chart" label="Analytics" caption="Top citt\u00e0 e specialit\u00e0" onPress={() => router.push('/admin/analytics' as any)} />
              <ActionTile theme={theme} icon="settings" label="Impostazioni" caption="Commissioni piattaforma" onPress={() => router.push('/admin/settings' as any)} />
            </View>
          </View>

          <Text style={[styles.footer, { color: theme.textMuted }]}>
            Generato {new Date(stats.generated_at).toLocaleString('it-IT')}
          </Text>
        </>
      )}
    </ScrollView>
  );
}

// ===== Sub-components =====

function BigStat({ theme, icon, accent, label, value, breakdown, caption, wide, onPress, showBadge }: any) {
  const Container: any = onPress ? TouchableOpacity : View;
  return (
    <Container
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : 1}
      style={[
        styles.bigStat,
        wide ? { flexBasis: '23%' } : { flexBasis: '48%' },
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={styles.bigStatHead}>
        <View style={[styles.bigStatIcon, { backgroundColor: `${accent}1A` }]}>
          <Ionicons name={icon} size={22} color={accent} />
        </View>
        {showBadge && <View style={[styles.dotBadge, { backgroundColor: accent }]} />}
      </View>
      <Text style={[styles.bigStatLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.bigStatValue, { color: theme.text }]}>{value}</Text>
      {caption && <Text style={[styles.bigStatCaption, { color: theme.textMuted }]}>{caption}</Text>}
      {breakdown && (
        <View style={styles.breakdown}>
          {breakdown.map((b: any, i: number) => (
            <View key={i} style={styles.breakdownItem}>
              <View style={[styles.breakdownDot, { backgroundColor: b.color }]} />
              <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>{b.label}</Text>
              <Text style={[styles.breakdownValue, { color: theme.text }]}>{b.value}</Text>
            </View>
          ))}
        </View>
      )}
    </Container>
  );
}

function UserRow({ theme, icon, color, label, value, total }: any) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <View style={styles.userRow}>
      <View style={[styles.userRowIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.userRowTop}>
          <Text style={[styles.userRowLabel, { color: theme.text }]}>{label}</Text>
          <Text style={[styles.userRowValue, { color: theme.text }]}>{value}</Text>
        </View>
        <View style={[styles.bar, { backgroundColor: theme.surfaceAlt }]}>
          <View style={[styles.barFill, { width: `${Math.max(pct, 2)}%`, backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

function CatalogRow({ theme, icon, label, value, caption }: any) {
  return (
    <View style={styles.catalogRow}>
      <Ionicons name={icon} size={20} color={theme.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.catalogLabel, { color: theme.text }]}>{label}</Text>
        {caption && <Text style={[styles.catalogCaption, { color: theme.textMuted }]}>{caption}</Text>}
      </View>
      <Text style={[styles.catalogValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function ActionTile({ theme, icon, label, caption, onPress }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.actionTile, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: theme.accent }]}>
        <Ionicons name={icon} size={18} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.actionCaption, { color: theme.textSecondary }]}>{caption}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  pageHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 18,
  },
  pageTitle: { fontSize: 26, fontWeight: '900' },
  pageSub: { fontSize: 13, marginTop: 4 },
  refreshBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, height: 36, borderRadius: 8, borderWidth: 1,
  },

  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16,
  },

  // BigStat
  heroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  bigStat: {
    flexGrow: 1, padding: 18, borderRadius: 16, borderWidth: 1, minWidth: 160,
  },
  bigStatHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bigStatIcon: {
    width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  dotBadge: { width: 12, height: 12, borderRadius: 6 },
  bigStatLabel: { fontSize: 12, fontWeight: '600', marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  bigStatValue: { fontSize: 30, fontWeight: '900', marginTop: 4, fontVariant: ['tabular-nums'] as any },
  bigStatCaption: { fontSize: 11, marginTop: 4 },
  breakdown: { marginTop: 14, gap: 4 },
  breakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  breakdownDot: { width: 6, height: 6, borderRadius: 3 },
  breakdownLabel: { fontSize: 11, flex: 1 },
  breakdownValue: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] as any },

  // Sections
  row: { flexDirection: 'row', gap: 16 },
  rowMobile: { flexDirection: 'column', gap: 0 },
  col: { flex: 1 },
  colMobile: { flex: 0, marginBottom: 16 },
  section: { padding: 18, borderRadius: 16, borderWidth: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },

  // UserRow
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  userRowIcon: {
    width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  userRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  userRowLabel: { fontSize: 13, fontWeight: '600' },
  userRowValue: { fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] as any },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%' as any, borderRadius: 3 },
  alertBox: {
    flexDirection: 'row', alignItems: 'center',
    padding: 8, borderRadius: 8, borderWidth: 1, marginTop: 10,
  },

  // CatalogRow
  catalogRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
  },
  catalogLabel: { fontSize: 13, fontWeight: '600' },
  catalogCaption: { fontSize: 11, marginTop: 2 },
  catalogValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] as any },

  // Quick actions
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionGridMobile: { flexDirection: 'column' },
  actionTile: {
    flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  actionIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 14, fontWeight: '700' },
  actionCaption: { fontSize: 11, marginTop: 1 },

  footer: { fontSize: 11, textAlign: 'center', marginTop: 14, fontStyle: 'italic' },
});
