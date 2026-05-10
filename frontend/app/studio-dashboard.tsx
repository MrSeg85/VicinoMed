import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Image, Platform, TextInput, Modal, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../src/useTheme';
import { useAuth } from '../src/AuthContext';
import { api } from '../src/api';
import { openExternal, mapsLink, whatsappLink } from '../src/utils';
import { RequestCard, RoomRequest } from '../src/components/RequestCard';
import { Toast, ToastType } from '../src/components/Toast';

interface Room {
  room_id: string;
  name: string;
  description?: string;
  equipment: string[];
  rental_modes: ('hourly' | 'daily')[];
  hourly_price?: number | null;
  daily_price?: number | null;
  available: boolean;
  photo?: string | null;
}

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
  rooms: Room[];
  photo?: string | null;
  verified: boolean;
}

interface Stats {
  rooms_total: number;
  rooms_available_today: number;
  requests_pending: number;
  estimated_income_month: number;
  accepted_this_month: number;
  accepted_total: number;
}

const ITA_GREETING = (() => {
  const h = new Date().getHours();
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
})();

type TabKey = 'pending' | 'history';

export default function StudioDashboard() {
  const theme = useTheme();
  const router = useRouter();
  const { user, logout } = useAuth();

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [requests, setRequests] = useState<RoomRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('pending');
  const [prevPending, setPrevPending] = useState<number | null>(null);

  const [toast, setToast] = useState<{ visible: boolean; msg: string; type: ToastType }>({
    visible: false, msg: '', type: 'info',
  });
  const showToast = (msg: string, type: ToastType = 'info') =>
    setToast({ visible: true, msg, type });

  const [respondModal, setRespondModal] = useState<{
    open: boolean; req: RoomRequest | null; action: 'accept' | 'reject';
  }>({ open: false, req: null, action: 'accept' });
  const [respondMsg, setRespondMsg] = useState('');
  const [responding, setResponding] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (user?.role !== 'studio') { setLoading(false); return; }
    if (!silent) setError(null);
    try {
      const [clinicR, statsR, reqsR] = await Promise.all([
        api.get('/studio/me'),
        api.get('/studio/stats'),
        api.get('/studio/requests', { params: { limit: 100 } }),
      ]);
      setClinic(clinicR.data);
      setStats(statsR.data);
      const reqs: RoomRequest[] = reqsR.data || [];
      // Detect new pending requests (notification)
      const currentPending = reqs.filter(r => r.status === 'pending').length;
      if (prevPending !== null && currentPending > prevPending) {
        const delta = currentPending - prevPending;
        // eslint-disable-next-line no-console
        console.log(`[VicinoMed] Nuova richiesta ricevuta (+${delta})`);
        showToast(
          delta === 1 ? '🔔 Nuova richiesta di prenotazione!' : `🔔 ${delta} nuove richieste!`,
          'info'
        );
      }
      setPrevPending(currentPending);
      setRequests(reqs);
    } catch (e: any) {
      const status = e?.response?.status;
      console.warn('[StudioDashboard] load FAILED', status);
      if (status === 403) setError('Solo gli account studio possono accedere a questa sezione.');
      else if (!silent) setError('Impossibile caricare la dashboard. Riprova.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Auto-refresh every 30s for new requests (only when focused via interval)
  useEffect(() => {
    if (user?.role !== 'studio') return;
    const interval = setInterval(() => load(true), 30000);
    return () => clearInterval(interval);
  }, [user, load]);

  useEffect(() => {
    if (user && user.role !== 'studio') {
      router.replace('/(tabs)/home' as any);
    }
  }, [user, router]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const profileComplete = !!(clinic && clinic.address && clinic.city && clinic.lat && clinic.lng);

  // Request handlers
  const handleAccept = (req: RoomRequest) => {
    setRespondModal({ open: true, req, action: 'accept' });
    setRespondMsg('');
  };
  const handleReject = (req: RoomRequest) => {
    setRespondModal({ open: true, req, action: 'reject' });
    setRespondMsg('');
  };

  const submitResponse = async () => {
    if (!respondModal.req || responding) return;
    setResponding(true);
    try {
      const url = `/studio/requests/${respondModal.req.request_id}/${respondModal.action}`;
      await api.patch(url, { response_message: respondMsg.trim() || undefined });
      setRespondModal({ open: false, req: null, action: 'accept' });
      setRespondMsg('');
      showToast(
        respondModal.action === 'accept' ? '✓ Richiesta accettata' : 'Richiesta rifiutata',
        respondModal.action === 'accept' ? 'success' : 'info'
      );
      // Reload data
      load(true);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore. Riprova.';
      showToast(msg, 'error');
    } finally {
      setResponding(false);
    }
  };

  const pendingReqs = requests.filter(r => r.status === 'pending');
  const historyReqs = requests.filter(r => r.status !== 'pending');

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
        {/* HERO with cover photo or gradient */}
        <View style={[styles.hero, { borderColor: theme.border }]}>
          {clinic?.photo ? (
            <Image source={{ uri: clinic.photo }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: theme.primary }]}>
              <View style={styles.heroPattern}>
                {[...Array(6)].map((_, i) => (
                  <Ionicons key={i} name="medical-outline" size={32 + i * 4} color={theme.primaryFg} style={{ opacity: 0.08 }} />
                ))}
              </View>
            </View>
          )}
          <View style={[styles.heroOverlay, { backgroundColor: theme.background + 'CC' }]} />
          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View style={[styles.rolePill, { backgroundColor: theme.background, borderColor: theme.primary }]}>
                <Ionicons name="business" size={12} color={theme.primary} />
                <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>STUDIO</Text>
              </View>
              <TouchableOpacity onPress={logout} style={[styles.heroIconBtn, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Ionicons name="log-out-outline" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.heroBottom}>
              <Text style={[styles.greeting, { color: theme.textSecondary }]}>{ITA_GREETING},</Text>
              <Text style={[styles.brand, { color: theme.text }]} numberOfLines={1}>
                {clinic?.name || user?.name || 'Il tuo Studio'}
              </Text>
              {clinic?.verified && (
                <View style={[styles.verifiedPill, { backgroundColor: theme.success }]}>
                  <Ionicons name="checkmark-circle" size={12} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800', marginLeft: 4 }}>VERIFICATO</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={{ padding: 20 }}>
          {error && (
            <View style={[styles.errorCard, { backgroundColor: theme.surface, borderColor: theme.error }]}>
              <Ionicons name="alert-circle" size={22} color={theme.error} />
              <Text style={{ color: theme.error, flex: 1, marginLeft: 10 }}>{error}</Text>
            </View>
          )}

          {/* Profile completion CTA */}
          {clinic && !profileComplete && (
            <TouchableOpacity
              style={[styles.alert, { backgroundColor: theme.accent, borderColor: theme.primary }]}
              onPress={() => router.push('/studio/profile' as any)}
            >
              <View style={[styles.alertIcon, { backgroundColor: theme.primary }]}>
                <Ionicons name="information-circle" size={20} color={theme.primaryFg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 14 }}>
                  Completa il profilo
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
                  Aggiungi indirizzo e geolocalizzazione per essere visibile ai medici.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.primary} />
            </TouchableOpacity>
          )}

          {/* STATS GRID 2x2 */}
          <View style={styles.statsGrid}>
            <StatCard
              theme={theme}
              icon="bed-outline"
              iconColor={theme.primary}
              label="Stanze totali"
              value={(stats?.rooms_total ?? 0).toString()}
              onPress={() => router.push('/studio/rooms' as any)}
            />
            <StatCard
              theme={theme}
              icon="checkmark-done-outline"
              iconColor={theme.success}
              label="Disponibili oggi"
              value={(stats?.rooms_available_today ?? 0).toString()}
              onPress={() => router.push('/studio/rooms' as any)}
            />
            <StatCard
              theme={theme}
              icon="mail-unread-outline"
              iconColor={theme.warning}
              label="In attesa"
              value={(stats?.requests_pending ?? 0).toString()}
              badge={(stats?.requests_pending ?? 0) > 0}
              onPress={() => setTab('pending')}
            />
            <StatCard
              theme={theme}
              icon="trending-up-outline"
              iconColor={theme.secondary}
              label="Stimato (mese)"
              value={`€${(stats?.estimated_income_month ?? 0).toFixed(0)}`}
              caption={`${stats?.accepted_this_month ?? 0} confermate`}
            />
          </View>

          {/* REQUESTS SECTION */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.dot, { backgroundColor: theme.warning }]} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Richieste di prenotazione</Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
              <TabBtn
                theme={theme}
                active={tab === 'pending'}
                label="In attesa"
                count={pendingReqs.length}
                onPress={() => setTab('pending')}
              />
              <TabBtn
                theme={theme}
                active={tab === 'history'}
                label="Storico"
                count={historyReqs.length}
                onPress={() => setTab('history')}
              />
            </View>

            {/* List */}
            {(tab === 'pending' ? pendingReqs : historyReqs).length === 0 ? (
              <View style={styles.empty}>
                <Ionicons
                  name={tab === 'pending' ? 'mail-open-outline' : 'archive-outline'}
                  size={48}
                  color={theme.textMuted}
                />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  {tab === 'pending' ? 'Nessuna richiesta in attesa' : 'Nessuna richiesta nello storico'}
                </Text>
                <Text style={[styles.emptyMsg, { color: theme.textSecondary }]}>
                  {tab === 'pending'
                    ? 'I medici interessati alle tue stanze ti invieranno qui le loro richieste.'
                    : 'Le richieste accettate o rifiutate appariranno qui.'}
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                {(tab === 'pending' ? pendingReqs : historyReqs).map(r => (
                  <RequestCard
                    key={r.request_id}
                    request={r}
                    view="studio"
                    onAccept={handleAccept}
                    onReject={handleReject}
                  />
                ))}
              </View>
            )}
          </View>

          {/* ROOMS SECTION */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.dot, { backgroundColor: theme.primary }]} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Le tue stanze</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/studio/rooms' as any)}
                style={[styles.seeAllBtn, { borderColor: theme.border }]}
              >
                <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>Gestisci</Text>
                <Ionicons name="chevron-forward" size={14} color={theme.primary} />
              </TouchableOpacity>
            </View>

            {clinic?.rooms?.length ? (
              <View style={styles.roomsGrid}>
                {clinic.rooms.slice(0, 4).map((room) => (
                  <RoomMiniCard key={room.room_id} room={room} theme={theme} onPress={() => router.push('/studio/rooms' as any)} />
                ))}
                {clinic.rooms.length > 4 && (
                  <TouchableOpacity
                    style={[styles.moreCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                    onPress={() => router.push('/studio/rooms' as any)}
                  >
                    <Ionicons name="add-circle-outline" size={28} color={theme.primary} />
                    <Text style={{ color: theme.primary, fontWeight: '800', marginTop: 6 }}>
                      +{clinic.rooms.length - 4} altre
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="bed-outline" size={48} color={theme.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Nessuna stanza configurata</Text>
                <Text style={[styles.emptyMsg, { color: theme.textSecondary }]}>
                  Aggiungi le stanze del tuo studio per renderle disponibili ai medici.
                </Text>
                <TouchableOpacity
                  style={[styles.ctaBtn, { backgroundColor: theme.primary }]}
                  onPress={() => router.push('/studio/rooms' as any)}
                >
                  <Ionicons name="add" size={18} color={theme.primaryFg} />
                  <Text style={{ color: theme.primaryFg, fontWeight: '800', marginLeft: 6 }}>Aggiungi prima stanza</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* SEDE */}
          {clinic && (
            <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.dot, { backgroundColor: theme.secondary }]} />
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Sede</Text>
                </View>
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

          {/* QUICK ACTIONS */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.dot, { backgroundColor: theme.text }]} />
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Azioni rapide</Text>
              </View>
            </View>
            <ActionListItem
              theme={theme}
              icon="create-outline"
              label="Modifica profilo studio"
              onPress={() => router.push('/studio/profile' as any)}
            />
            <ActionListItem
              theme={theme}
              icon="bed-outline"
              label="Gestisci stanze"
              onPress={() => router.push('/studio/rooms' as any)}
              isLast
            />
          </View>

          <Text style={[styles.footer, { color: theme.textMuted }]}>
            VicinoMed Studio · v1.1
          </Text>
        </View>
      </ScrollView>

      {/* Response Modal */}
      <Modal
        visible={respondModal.open}
        transparent
        animationType="fade"
        onRequestClose={() => setRespondModal({ open: false, req: null, action: 'accept' })}
      >
        <KeyboardAvoidingView
          style={modalStyles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={() => setRespondModal({ open: false, req: null, action: 'accept' })} />
          <View style={[modalStyles.card, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={[modalStyles.header, { borderBottomColor: theme.border }]}>
              <Ionicons
                name={respondModal.action === 'accept' ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={respondModal.action === 'accept' ? theme.success : theme.error}
              />
              <Text style={[modalStyles.title, { color: theme.text }]}>
                {respondModal.action === 'accept' ? 'Accetta richiesta' : 'Rifiuta richiesta'}
              </Text>
            </View>

            {respondModal.req && (
              <View style={modalStyles.body}>
                <Text style={[modalStyles.subtitle, { color: theme.textSecondary }]}>
                  {respondModal.req.doctor_name} · {respondModal.req.room_name}
                </Text>
                <Text style={[modalStyles.label, { color: theme.text }]}>
                  {respondModal.action === 'accept'
                    ? 'Messaggio per il medico (opzionale)'
                    : 'Motivo del rifiuto (opzionale)'}
                </Text>
                <TextInput
                  value={respondMsg}
                  onChangeText={setRespondMsg}
                  placeholder={
                    respondModal.action === 'accept'
                      ? 'Es. Confermo, ti aspetto in studio…'
                      : 'Es. Stanza non disponibile in quella data…'
                  }
                  placeholderTextColor={theme.textMuted}
                  multiline
                  maxLength={600}
                  style={[modalStyles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                />
                <View style={modalStyles.actions}>
                  <TouchableOpacity
                    style={[modalStyles.btn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                    onPress={() => setRespondModal({ open: false, req: null, action: 'accept' })}
                  >
                    <Text style={{ color: theme.text, fontWeight: '700' }}>Annulla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={responding}
                    style={[modalStyles.btn, {
                      backgroundColor: respondModal.action === 'accept' ? theme.success : theme.error,
                      borderColor: respondModal.action === 'accept' ? theme.success : theme.error,
                    }]}
                    onPress={submitResponse}
                  >
                    {responding ? (
                      <ActivityIndicator color="#FFF" />
                    ) : (
                      <Text style={{ color: '#FFF', fontWeight: '800' }}>
                        {respondModal.action === 'accept' ? 'Conferma accettazione' : 'Conferma rifiuto'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Toast
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </SafeAreaView>
  );
}

// ===== Sub-components =====

function StatCard({ theme, icon, iconColor, label, value, caption, badge, onPress }: any) {
  const Container: any = onPress ? TouchableOpacity : View;
  return (
    <Container
      onPress={onPress}
      style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      activeOpacity={onPress ? 0.85 : 1}
    >
      <View style={styles.statHead}>
        <View style={[styles.statIconBg, { backgroundColor: `${iconColor}20` }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        {badge && <View style={[styles.statBadge, { backgroundColor: theme.error }]} />}
      </View>
      <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]} numberOfLines={1}>{label}</Text>
      {!!caption && (
        <Text style={[styles.statCaption, { color: theme.textMuted }]} numberOfLines={1}>{caption}</Text>
      )}
    </Container>
  );
}

function TabBtn({ theme, active, label, count, onPress }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.tabBtn, { borderBottomColor: active ? theme.primary : 'transparent' }]}
    >
      <Text style={{ color: active ? theme.primary : theme.textSecondary, fontWeight: '700', fontSize: 14 }}>
        {label}
      </Text>
      {count > 0 && (
        <View style={[styles.tabCount, { backgroundColor: active ? theme.primary : theme.surfaceAlt }]}>
          <Text style={{ color: active ? theme.primaryFg : theme.text, fontSize: 11, fontWeight: '800' }}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function RoomMiniCard({ room, theme, onPress }: { room: Room; theme: any; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.roomCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
      activeOpacity={0.85}
    >
      <View style={styles.roomCardHead}>
        {room.photo ? (
          <Image source={{ uri: room.photo }} style={styles.roomThumb} />
        ) : (
          <View style={[styles.roomThumb, { backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="bed-outline" size={28} color={theme.primary} />
          </View>
        )}
        <View style={[styles.availDot, { backgroundColor: room.available ? theme.success : theme.textMuted }]} />
      </View>
      <Text style={[styles.roomCardName, { color: theme.text }]} numberOfLines={1}>{room.name}</Text>
      <View style={styles.roomCardPrices}>
        {room.rental_modes.includes('hourly') && room.hourly_price != null && (
          <Text style={[styles.priceText, { color: theme.primary }]}>
            €{room.hourly_price.toFixed(0)}<Text style={{ fontSize: 10, color: theme.textMuted }}>/h</Text>
          </Text>
        )}
        {room.rental_modes.includes('daily') && room.daily_price != null && (
          <Text style={[styles.priceText, { color: theme.primary, fontSize: 13 }]}>
            €{room.daily_price.toFixed(0)}<Text style={{ fontSize: 10, color: theme.textMuted }}>/g</Text>
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ActionListItem({ theme, icon, label, onPress, isLast }: any) {
  return (
    <TouchableOpacity
      style={[styles.actionListItem, { borderColor: theme.border, borderBottomWidth: isLast ? 0 : 1 }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={theme.text} />
      <Text style={[styles.actionListText, { color: theme.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { paddingBottom: 40 },

  // HERO
  hero: { height: 200, position: 'relative', overflow: 'hidden' },
  heroImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  heroPattern: {
    flexDirection: 'row', flexWrap: 'wrap', padding: 20, gap: 16, alignItems: 'flex-start', justifyContent: 'space-around',
  },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroContent: { flex: 1, justifyContent: 'space-between', padding: 16 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroBottom: { },
  rolePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1.5,
  },
  heroIconBtn: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  greeting: { fontSize: 13, fontWeight: '600' },
  brand: { fontSize: 26, fontWeight: '900', marginTop: 2 },
  verifiedPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 8,
  },

  // ALERT
  errorCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 14, borderWidth: 1, marginBottom: 16,
  },
  alert: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: 14, borderWidth: 1.5, marginBottom: 16, gap: 10,
  },
  alertIcon: {
    width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center',
  },

  // STATS
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  statCard: {
    flexBasis: '48%', flexGrow: 1, padding: 14, borderRadius: 16, borderWidth: 1,
  },
  statHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statIconBg: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  statBadge: { width: 10, height: 10, borderRadius: 5 },
  statValue: { fontSize: 22, fontWeight: '900', marginTop: 10 },
  statLabel: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  statCaption: { fontSize: 10, marginTop: 4, fontWeight: '600' },

  // SECTIONS
  section: { padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1,
  },

  // TABS
  tabBar: { flexDirection: 'row', marginTop: 8, marginBottom: 4, gap: 16 },
  tabBtn: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 8, borderBottomWidth: 2,
  },
  tabCount: {
    minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // EMPTY
  empty: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 12 },
  emptyMsg: {
    fontSize: 13, textAlign: 'center', marginTop: 6, marginHorizontal: 16, lineHeight: 19,
  },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, height: 42, borderRadius: 12, marginTop: 14,
  },

  // ROOMS GRID
  roomsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  roomCard: {
    flexBasis: '48%', flexGrow: 1, padding: 10, borderRadius: 14, borderWidth: 1,
  },
  roomCardHead: { position: 'relative', marginBottom: 8 },
  roomThumb: { width: '100%', height: 80, borderRadius: 10 },
  availDot: {
    position: 'absolute', top: 6, right: 6, width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: '#FFF',
  },
  roomCardName: { fontSize: 14, fontWeight: '800' },
  roomCardPrices: { flexDirection: 'row', gap: 8, marginTop: 4 },
  priceText: { fontSize: 14, fontWeight: '800' },
  moreCard: {
    flexBasis: '48%', flexGrow: 1, padding: 10, borderRadius: 14, borderWidth: 1,
    minHeight: 130, alignItems: 'center', justifyContent: 'center',
  },

  // ADDR
  addressText: { fontSize: 15, fontWeight: '700', marginTop: 8 },
  addressSub: { fontSize: 13, marginTop: 2 },
  description: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 38, borderRadius: 10, borderWidth: 1,
  },
  actionText: { fontSize: 13, fontWeight: '700' },

  // ACTION LIST
  actionListItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
  },
  actionListText: { flex: 1, fontSize: 15, fontWeight: '600' },

  footer: { textAlign: 'center', fontSize: 12, marginTop: 8 },
});

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontWeight: '800' },
  body: { padding: 18 },
  subtitle: { fontSize: 13, fontWeight: '600', marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: {
    borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14,
    minHeight: 90, textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: {
    flex: 1, height: 46, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
});
