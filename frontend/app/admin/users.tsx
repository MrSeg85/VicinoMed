import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput,
  TouchableOpacity, RefreshControl, Alert, useWindowDimensions, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useTheme } from '../../src/useTheme';

interface UserData {
  user_id: string;
  email: string;
  name: string;
  role: 'patient' | 'doctor' | 'studio' | 'admin';
  phone?: string;
  picture?: string;
  is_active: boolean;
  verified: boolean;
  created_at: string;
  auth_provider?: string;
}

type RoleFilter = 'all' | 'patient' | 'doctor' | 'studio' | 'admin';
type StatusFilter = 'all' | 'active' | 'suspended' | 'verified' | 'unverified';

const ROLE_COLORS: Record<string, string> = {
  patient: '#06B6D4',
  doctor: '#10B981',
  studio: '#8B5CF6',
  admin: '#0A3D62',
};

const ROLE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  patient: 'person-outline',
  doctor: 'medical-outline',
  studio: 'business-outline',
  admin: 'shield-checkmark-outline',
};

const ROLE_LABELS: Record<string, string> = {
  patient: 'Paziente',
  doctor: 'Medico',
  studio: 'Studio',
  admin: 'Admin',
};

export default function AdminUsers() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const LIMIT = 20;

  const loadUsers = useCallback(async (reset = false) => {
    try {
      const params: any = { limit: LIMIT, skip: reset ? 0 : (page - 1) * LIMIT };
      if (search.trim()) params.q = search.trim();
      if (roleFilter !== 'all') params.role = roleFilter;
      if (statusFilter === 'active') params.is_active = 'true';
      if (statusFilter === 'suspended') params.is_active = 'false';
      if (statusFilter === 'verified') params.verified = 'true';
      if (statusFilter === 'unverified') params.verified = 'false';

      const r = await api.get('/admin/users', { params });
      const data = r.data || [];
      setUsers(reset ? data : [...users, ...data]);
      setHasMore(data.length === LIMIT);
      setError(null);
    } catch (e: any) {
      console.warn('[AdminUsers] load fail', e?.response?.status, e?.message);
      setError('Impossibile caricare gli utenti.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, roleFilter, statusFilter, page, users]);

  useFocusEffect(useCallback(() => {
    setPage(1);
    setLoading(true);
    loadUsers(true);
  }, [search, roleFilter, statusFilter]));

  useEffect(() => {
    if (page > 1) loadUsers(false);
  }, [page]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    loadUsers(true);
  };

  const handleVerify = async (user: UserData) => {
    const action = user.verified ? 'rimuovere la verifica' : 'verificare';
    const confirmMsg = `Vuoi ${action} ${user.name || user.email}?`;
    
    const doAction = async () => {
      try {
        await api.patch(`/admin/users/${user.user_id}/verify`);
        setUsers(prev => prev.map(u => 
          u.user_id === user.user_id ? { ...u, verified: !u.verified } : u
        ));
      } catch (e: any) {
        Alert.alert('Errore', e?.response?.data?.detail || 'Operazione fallita');
      }
    };

    if (Platform.OS === 'web') {
      if (confirm(confirmMsg)) doAction();
    } else {
      Alert.alert('Conferma', confirmMsg, [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Conferma', onPress: doAction },
      ]);
    }
  };

  const handleToggleActive = async (user: UserData) => {
    if (user.role === 'admin') {
      Alert.alert('Errore', 'Non puoi sospendere un admin.');
      return;
    }
    const action = user.is_active ? 'sospendere' : 'riattivare';
    const confirmMsg = `Vuoi ${action} ${user.name || user.email}?`;
    
    const doAction = async () => {
      try {
        const endpoint = user.is_active 
          ? `/admin/users/${user.user_id}/suspend`
          : `/admin/users/${user.user_id}/activate`;
        await api.patch(endpoint);
        setUsers(prev => prev.map(u => 
          u.user_id === user.user_id ? { ...u, is_active: !u.is_active } : u
        ));
      } catch (e: any) {
        Alert.alert('Errore', e?.response?.data?.detail || 'Operazione fallita');
      }
    };

    if (Platform.OS === 'web') {
      if (confirm(confirmMsg)) doAction();
    } else {
      Alert.alert('Conferma', confirmMsg, [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Conferma', style: user.is_active ? 'destructive' : 'default', onPress: doAction },
      ]);
    }
  };

  const handleDelete = async (user: UserData) => {
    if (user.role === 'admin') {
      Alert.alert('Errore', 'Non puoi eliminare un admin.');
      return;
    }
    const confirmMsg = `Sei sicuro di voler ELIMINARE definitivamente ${user.name || user.email}? Questa azione non può essere annullata.`;
    
    const doAction = async () => {
      try {
        await api.delete(`/admin/users/${user.user_id}`);
        setUsers(prev => prev.filter(u => u.user_id !== user.user_id));
      } catch (e: any) {
        Alert.alert('Errore', e?.response?.data?.detail || 'Eliminazione fallita');
      }
    };

    if (Platform.OS === 'web') {
      if (confirm(confirmMsg)) doAction();
    } else {
      Alert.alert('Elimina utente', confirmMsg, [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: doAction },
      ]);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('it-IT', { 
        day: '2-digit', month: 'short', year: 'numeric' 
      });
    } catch { return '-'; }
  };

  if (loading && users.length === 0) {
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
      {/* Header */}
      <View style={styles.pageHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.pageTitle, { color: theme.text }]}>Gestione Utenti</Text>
          <Text style={[styles.pageSub, { color: theme.textSecondary }]}>
            Lista, ricerca e moderazione utenti della piattaforma
          </Text>
        </View>
      </View>

      {/* Search & Filters */}
      <View style={[styles.filtersCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Cerca per nome o email..."
            placeholderTextColor={theme.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Role filter */}
        <View style={styles.filterRow}>
          <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Ruolo:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View style={styles.filterChips}>
              {(['all', 'patient', 'doctor', 'studio', 'admin'] as RoleFilter[]).map(r => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.chip,
                    { borderColor: theme.border },
                    roleFilter === r && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                  onPress={() => setRoleFilter(r)}
                >
                  <Text style={[
                    styles.chipText,
                    { color: roleFilter === r ? '#FFF' : theme.text },
                  ]}>
                    {r === 'all' ? 'Tutti' : ROLE_LABELS[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Status filter */}
        <View style={styles.filterRow}>
          <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Stato:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View style={styles.filterChips}>
              {([
                { key: 'all', label: 'Tutti' },
                { key: 'active', label: 'Attivi' },
                { key: 'suspended', label: 'Sospesi' },
                { key: 'verified', label: 'Verificati' },
                { key: 'unverified', label: 'Non verificati' },
              ] as { key: StatusFilter; label: string }[]).map(s => (
                <TouchableOpacity
                  key={s.key}
                  style={[
                    styles.chip,
                    { borderColor: theme.border },
                    statusFilter === s.key && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                  onPress={() => setStatusFilter(s.key)}
                >
                  <Text style={[
                    styles.chipText,
                    { color: statusFilter === s.key ? '#FFF' : theme.text },
                  ]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: theme.surface, borderColor: theme.error }]}>
          <Ionicons name="alert-circle" size={20} color={theme.error} />
          <Text style={{ color: theme.error, marginLeft: 10, flex: 1 }}>{error}</Text>
        </View>
      )}

      {/* Results count */}
      <Text style={[styles.resultsCount, { color: theme.textSecondary }]}>
        {users.length} utent{users.length === 1 ? 'e' : 'i'} trovat{users.length === 1 ? 'o' : 'i'}
      </Text>

      {/* Users list */}
      {users.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="people-outline" size={48} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Nessun utente trovato con i filtri selezionati.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {users.map(user => (
            <UserCard
              key={user.user_id}
              user={user}
              theme={theme}
              isWide={isWide}
              onVerify={() => handleVerify(user)}
              onToggleActive={() => handleToggleActive(user)}
              onDelete={() => handleDelete(user)}
              formatDate={formatDate}
            />
          ))}
        </View>
      )}

      {/* Load more */}
      {hasMore && (
        <TouchableOpacity
          style={[styles.loadMoreBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => setPage(p => p + 1)}
        >
          <Text style={[styles.loadMoreText, { color: theme.primary }]}>Carica altri</Text>
          <Ionicons name="chevron-down" size={18} color={theme.primary} />
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// === User Card Component ===
function UserCard({ user, theme, isWide, onVerify, onToggleActive, onDelete, formatDate }: {
  user: UserData;
  theme: any;
  isWide: boolean;
  onVerify: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  formatDate: (iso: string) => string;
}) {
  const roleColor = ROLE_COLORS[user.role] || theme.textSecondary;
  const roleIcon = ROLE_ICONS[user.role] || 'person';

  return (
    <View style={[
      styles.userCard,
      { backgroundColor: theme.surface, borderColor: theme.border },
      !user.is_active && { opacity: 0.7, borderColor: theme.error },
    ]}>
      {/* Main info */}
      <View style={styles.userCardMain}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: `${roleColor}20` }]}>
          <Ionicons name={roleIcon} size={22} color={roleColor} />
        </View>

        {/* Info */}
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
              {user.name || 'Senza nome'}
            </Text>
            {user.verified && (
              <View style={[styles.verifiedBadge, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                <Text style={styles.verifiedText}>Verificato</Text>
              </View>
            )}
            {!user.is_active && (
              <View style={[styles.suspendedBadge, { backgroundColor: `${theme.error}20` }]}>
                <Ionicons name="ban" size={12} color={theme.error} />
                <Text style={[styles.suspendedText, { color: theme.error }]}>Sospeso</Text>
              </View>
            )}
          </View>
          <Text style={[styles.userEmail, { color: theme.textSecondary }]} numberOfLines={1}>
            {user.email}
          </Text>
          <View style={styles.userMeta}>
            <View style={[styles.rolePill, { backgroundColor: `${roleColor}20` }]}>
              <Text style={[styles.roleText, { color: roleColor }]}>{ROLE_LABELS[user.role]}</Text>
            </View>
            {user.phone && (
              <Text style={[styles.metaText, { color: theme.textMuted }]}>
                <Ionicons name="call-outline" size={11} color={theme.textMuted} /> {user.phone}
              </Text>
            )}
            <Text style={[styles.metaText, { color: theme.textMuted }]}>
              <Ionicons name="calendar-outline" size={11} color={theme.textMuted} /> {formatDate(user.created_at)}
            </Text>
            {user.auth_provider === 'google' && (
              <View style={styles.googleBadge}>
                <Ionicons name="logo-google" size={11} color="#4285F4" />
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={[styles.userActions, isWide && styles.userActionsWide]}>
        {/* Verify button */}
        <TouchableOpacity
          style={[
            styles.actionBtn,
            { borderColor: user.verified ? '#10B981' : theme.border },
            user.verified && { backgroundColor: '#10B98115' },
          ]}
          onPress={onVerify}
        >
          <Ionicons 
            name={user.verified ? 'checkmark-circle' : 'checkmark-circle-outline'} 
            size={16} 
            color={user.verified ? '#10B981' : theme.textSecondary} 
          />
          <Text style={[styles.actionBtnText, { color: user.verified ? '#10B981' : theme.textSecondary }]}>
            {user.verified ? 'Verificato' : 'Verifica'}
          </Text>
        </TouchableOpacity>

        {/* Suspend/Activate button */}
        {user.role !== 'admin' && (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { borderColor: user.is_active ? '#F59E0B' : '#10B981' },
              !user.is_active && { backgroundColor: '#10B98115' },
            ]}
            onPress={onToggleActive}
          >
            <Ionicons 
              name={user.is_active ? 'pause-circle-outline' : 'play-circle-outline'} 
              size={16} 
              color={user.is_active ? '#F59E0B' : '#10B981'} 
            />
            <Text style={[styles.actionBtnText, { color: user.is_active ? '#F59E0B' : '#10B981' }]}>
              {user.is_active ? 'Sospendi' : 'Attiva'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Delete button */}
        {user.role !== 'admin' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn, { borderColor: theme.error }]}
            onPress={onDelete}
          >
            <Ionicons name="trash-outline" size={16} color={theme.error} />
          </TouchableOpacity>
        )}
      </View>
    </View>
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

  filtersCard: {
    padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16, gap: 12,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, height: 44, borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, height: '100%' },

  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filterLabel: { fontSize: 12, fontWeight: '600', width: 50 },
  filterChips: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '600' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16,
  },

  resultsCount: { fontSize: 12, fontWeight: '600', marginBottom: 12, marginLeft: 2 },

  emptyBox: {
    padding: 40, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 12,
  },
  emptyText: { fontSize: 14, textAlign: 'center' },

  userCard: {
    padding: 16, borderRadius: 14, borderWidth: 1,
  },
  userCardMain: { flexDirection: 'row', gap: 14 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center',
  },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  userName: { fontSize: 15, fontWeight: '700' },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  verifiedText: { fontSize: 10, fontWeight: '700', color: '#10B981' },
  suspendedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  suspendedText: { fontSize: 10, fontWeight: '700' },
  userEmail: { fontSize: 13, marginTop: 2 },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  roleText: { fontSize: 11, fontWeight: '700' },
  metaText: { fontSize: 11 },
  googleBadge: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#4285F420',
    justifyContent: 'center', alignItems: 'center',
  },

  userActions: {
    flexDirection: 'row', gap: 8, marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)',
  },
  userActionsWide: { marginTop: 0, paddingTop: 0, borderTopWidth: 0, marginLeft: 'auto' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  deleteBtn: { paddingHorizontal: 10 },

  loadMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 16,
  },
  loadMoreText: { fontSize: 14, fontWeight: '700' },
});
