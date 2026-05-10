import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { api } from '../../src/api';
import { RequestCard, RoomRequest } from '../../src/components/RequestCard';
import { Toast, ToastType } from '../../src/components/Toast';

type Filter = 'all' | 'pending' | 'accepted' | 'rejected';

export default function MyRequestsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [requests, setRequests] = useState<RoomRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [toast, setToast] = useState<{ visible: boolean; msg: string; type: ToastType }>({
    visible: false, msg: '', type: 'info',
  });

  const load = useCallback(async () => {
    try {
      const r = await api.get('/doctor/room-requests', { params: { limit: 100 } });
      setRequests(r.data || []);
    } catch (e) {
      console.warn('[MyRequests] load fail', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const onCancel = async (req: RoomRequest) => {
    try {
      await api.patch(`/doctor/room-requests/${req.request_id}/cancel`);
      setToast({ visible: true, msg: 'Richiesta annullata', type: 'info' });
      load();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore. Riprova.';
      setToast({ visible: true, msg, type: 'error' });
    }
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    accepted: requests.filter(r => r.status === 'accepted').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Le mie richieste</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            Stato delle richieste di affitto stanze
          </Text>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
        style={{ flexGrow: 0 }}
      >
        <FilterChip theme={theme} active={filter === 'all'} label="Tutte" count={counts.all} onPress={() => setFilter('all')} />
        <FilterChip theme={theme} active={filter === 'pending'} label="In attesa" count={counts.pending} color="#F59E0B" onPress={() => setFilter('pending')} />
        <FilterChip theme={theme} active={filter === 'accepted'} label="Accettate" count={counts.accepted} color={theme.success} onPress={() => setFilter('accepted')} />
        <FilterChip theme={theme} active={filter === 'rejected'} label="Rifiutate" count={counts.rejected} color={theme.error} onPress={() => setFilter('rejected')} />
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
      ) : filtered.length === 0 ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        >
          <Ionicons name="paper-plane-outline" size={56} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {filter === 'all' ? 'Nessuna richiesta inviata' : 'Nessuna richiesta in questo stato'}
          </Text>
          <Text style={[styles.emptyMsg, { color: theme.textSecondary }]}>
            {filter === 'all'
              ? 'Cerca uno studio e invia una richiesta di affitto. Le tue richieste appariranno qui.'
              : 'Non ci sono richieste con questo stato.'}
          </Text>
          {filter === 'all' && (
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: theme.primary }]}
              onPress={() => router.push('/doctor/rent-rooms' as any)}
            >
              <Ionicons name="search" size={18} color={theme.primaryFg} />
              <Text style={{ color: theme.primaryFg, fontWeight: '800', marginLeft: 8 }}>Cerca stanze</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        >
          {filtered.map(r => (
            <RequestCard
              key={r.request_id}
              request={r}
              view="doctor"
              onCancel={onCancel}
            />
          ))}
        </ScrollView>
      )}

      <Toast
        visible={toast.visible}
        message={toast.msg}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </SafeAreaView>
  );
}

function FilterChip({ theme, active, label, count, color, onPress }: any) {
  const accent = color || theme.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: active ? accent : theme.surface,
          borderColor: active ? accent : theme.border,
        },
      ]}
    >
      <Text style={{ color: active ? '#FFF' : theme.text, fontWeight: '700', fontSize: 13 }}>{label}</Text>
      <View style={[styles.chipCount, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : theme.surfaceAlt }]}>
        <Text style={{ color: active ? '#FFF' : theme.text, fontSize: 11, fontWeight: '800' }}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, height: 36, borderRadius: 999, borderWidth: 1.5,
  },
  chipCount: {
    minWidth: 22, paddingHorizontal: 6, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  emptyMsg: {
    fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20, marginHorizontal: 16,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, height: 46, borderRadius: 12, marginTop: 18,
  },
});
