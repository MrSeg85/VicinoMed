import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput,
  TouchableOpacity, RefreshControl, useWindowDimensions, Modal, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useTheme } from '../../src/useTheme';

interface Room {
  room_id: string;
  name: string;
  description?: string;
  equipment: string[];
  rental_modes: ('hourly' | 'daily')[];
  hourly_price?: number;
  daily_price?: number;
  available: boolean;
  photo?: string;
}

interface Clinic {
  clinic_id: string;
  owner_email: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  postal_code: string;
  lat: number;
  lng: number;
  phone: string;
  whatsapp?: string;
  rooms_count: number;
  rooms: Room[];
  photo?: string;
  verified: boolean;
  pending_requests?: number;
  created_at: string;
}

export default function AdminClinics() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);

  const loadClinics = useCallback(async () => {
    try {
      const params: any = {};
      if (search.trim()) params.q = search.trim();
      const r = await api.get('/admin/clinics', { params });
      setClinics(r.data || []);
      setError(null);
    } catch (e: any) {
      console.warn('[AdminClinics] load fail', e?.response?.status, e?.message);
      setError('Impossibile caricare gli studi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadClinics();
  }, [search]));

  const onRefresh = () => {
    setRefreshing(true);
    loadClinics();
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('it-IT', { 
        day: '2-digit', month: 'short', year: 'numeric' 
      });
    } catch { return '-'; }
  };

  if (loading && clinics.length === 0) {
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
          <Text style={[styles.pageTitle, { color: theme.text }]}>Studi Medici</Text>
          <Text style={[styles.pageSub, { color: theme.textSecondary }]}>
            Tutte le cliniche e centri medici della piattaforma
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={[styles.searchCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.searchBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Cerca per nome, città o indirizzo..."
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
      </View>

      {error && (
        <View style={[styles.errorBox, { backgroundColor: theme.surface, borderColor: theme.error }]}>
          <Ionicons name="alert-circle" size={20} color={theme.error} />
          <Text style={{ color: theme.error, marginLeft: 10, flex: 1 }}>{error}</Text>
        </View>
      )}

      {/* Stats summary */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="business" size={20} color="#8B5CF6" />
          <Text style={[styles.statValue, { color: theme.text }]}>{clinics.length}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Studi</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="bed" size={20} color="#06B6D4" />
          <Text style={[styles.statValue, { color: theme.text }]}>
            {clinics.reduce((acc, c) => acc + (c.rooms?.length || 0), 0)}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Stanze</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={[styles.statValue, { color: theme.text }]}>
            {clinics.filter(c => c.verified).length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Verificati</Text>
        </View>
      </View>

      {/* Clinics list */}
      {clinics.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="business-outline" size={48} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Nessuno studio trovato.
          </Text>
        </View>
      ) : (
        <View style={[styles.clinicsGrid, isWide && styles.clinicsGridWide]}>
          {clinics.map(clinic => (
            <ClinicCard
              key={clinic.clinic_id}
              clinic={clinic}
              theme={theme}
              isWide={isWide}
              formatDate={formatDate}
              onViewDetails={() => setSelectedClinic(clinic)}
            />
          ))}
        </View>
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!selectedClinic}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedClinic(null)}
      >
        {selectedClinic && (
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={1}>
                  {selectedClinic.name}
                </Text>
                <TouchableOpacity onPress={() => setSelectedClinic(null)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                {/* Info */}
                <View style={[styles.detailSection, { borderColor: theme.border }]}>
                  <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Informazioni</Text>
                  <DetailRow icon="mail" label="Email proprietario" value={selectedClinic.owner_email} theme={theme} />
                  <DetailRow icon="location" label="Indirizzo" value={`${selectedClinic.address}, ${selectedClinic.city} ${selectedClinic.postal_code}`} theme={theme} />
                  <DetailRow icon="call" label="Telefono" value={selectedClinic.phone} theme={theme} />
                  {selectedClinic.whatsapp && <DetailRow icon="logo-whatsapp" label="WhatsApp" value={selectedClinic.whatsapp} theme={theme} />}
                  <DetailRow icon="calendar" label="Registrato il" value={formatDate(selectedClinic.created_at)} theme={theme} />
                  <DetailRow 
                    icon="checkmark-circle" 
                    label="Stato" 
                    value={selectedClinic.verified ? 'Verificato ✓' : 'Non verificato'} 
                    theme={theme} 
                    valueColor={selectedClinic.verified ? '#10B981' : theme.textSecondary}
                  />
                </View>

                {/* Description */}
                {selectedClinic.description && (
                  <View style={[styles.detailSection, { borderColor: theme.border }]}>
                    <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Descrizione</Text>
                    <Text style={[styles.descriptionText, { color: theme.textSecondary }]}>
                      {selectedClinic.description}
                    </Text>
                  </View>
                )}

                {/* Rooms */}
                <View style={[styles.detailSection, { borderColor: theme.border }]}>
                  <Text style={[styles.detailSectionTitle, { color: theme.text }]}>
                    Stanze ({selectedClinic.rooms?.length || 0})
                  </Text>
                  {(!selectedClinic.rooms || selectedClinic.rooms.length === 0) ? (
                    <Text style={[styles.noRoomsText, { color: theme.textMuted }]}>
                      Nessuna stanza configurata.
                    </Text>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {selectedClinic.rooms.map(room => (
                        <View 
                          key={room.room_id} 
                          style={[styles.roomCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                        >
                          <View style={styles.roomHeader}>
                            <Text style={[styles.roomName, { color: theme.text }]}>{room.name}</Text>
                            <View style={[
                              styles.roomStatus,
                              { backgroundColor: room.available ? '#10B98120' : `${theme.error}20` }
                            ]}>
                              <View style={[
                                styles.roomStatusDot,
                                { backgroundColor: room.available ? '#10B981' : theme.error }
                              ]} />
                              <Text style={[
                                styles.roomStatusText,
                                { color: room.available ? '#10B981' : theme.error }
                              ]}>
                                {room.available ? 'Disponibile' : 'Non disponibile'}
                              </Text>
                            </View>
                          </View>
                          {room.description && (
                            <Text style={[styles.roomDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                              {room.description}
                            </Text>
                          )}
                          <View style={styles.roomMeta}>
                            {room.hourly_price != null && (
                              <View style={[styles.pricePill, { backgroundColor: theme.surface }]}>
                                <Ionicons name="time-outline" size={12} color={theme.primary} />
                                <Text style={[styles.priceText, { color: theme.text }]}>€{room.hourly_price}/ora</Text>
                              </View>
                            )}
                            {room.daily_price != null && (
                              <View style={[styles.pricePill, { backgroundColor: theme.surface }]}>
                                <Ionicons name="calendar-outline" size={12} color={theme.primary} />
                                <Text style={[styles.priceText, { color: theme.text }]}>€{room.daily_price}/giorno</Text>
                              </View>
                            )}
                          </View>
                          {room.equipment && room.equipment.length > 0 && (
                            <View style={styles.equipmentRow}>
                              {room.equipment.slice(0, 4).map((eq, i) => (
                                <View key={i} style={[styles.equipTag, { backgroundColor: theme.surface }]}>
                                  <Text style={[styles.equipText, { color: theme.textSecondary }]}>{eq}</Text>
                                </View>
                              ))}
                              {room.equipment.length > 4 && (
                                <Text style={[styles.equipMore, { color: theme.textMuted }]}>
                                  +{room.equipment.length - 4}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>
    </ScrollView>
  );
}

// === Clinic Card Component ===
function ClinicCard({ clinic, theme, isWide, formatDate, onViewDetails }: {
  clinic: Clinic;
  theme: any;
  isWide: boolean;
  formatDate: (iso: string) => string;
  onViewDetails: () => void;
}) {
  const roomsCount = clinic.rooms?.length || 0;
  const availableRooms = clinic.rooms?.filter(r => r.available).length || 0;

  return (
    <TouchableOpacity
      style={[
        styles.clinicCard,
        { backgroundColor: theme.surface, borderColor: theme.border },
        isWide && styles.clinicCardWide,
      ]}
      onPress={onViewDetails}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.clinicHeader}>
        <View style={[styles.clinicIcon, { backgroundColor: '#8B5CF620' }]}>
          <Ionicons name="business" size={22} color="#8B5CF6" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.clinicNameRow}>
            <Text style={[styles.clinicName, { color: theme.text }]} numberOfLines={1}>
              {clinic.name}
            </Text>
            {clinic.verified && (
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            )}
          </View>
          <Text style={[styles.clinicCity, { color: theme.textSecondary }]} numberOfLines={1}>
            {clinic.city} • {clinic.address}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.clinicStats}>
        <View style={styles.clinicStat}>
          <Ionicons name="bed-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.clinicStatText, { color: theme.text }]}>
            {roomsCount} {roomsCount === 1 ? 'stanza' : 'stanze'}
          </Text>
        </View>
        {roomsCount > 0 && (
          <View style={styles.clinicStat}>
            <View style={[styles.availDot, { backgroundColor: availableRooms > 0 ? '#10B981' : theme.textMuted }]} />
            <Text style={[styles.clinicStatText, { color: availableRooms > 0 ? '#10B981' : theme.textMuted }]}>
              {availableRooms} disponibil{availableRooms === 1 ? 'e' : 'i'}
            </Text>
          </View>
        )}
      </View>

      {/* Owner */}
      <View style={[styles.clinicOwner, { borderTopColor: theme.border }]}>
        <Ionicons name="person-outline" size={12} color={theme.textMuted} />
        <Text style={[styles.clinicOwnerText, { color: theme.textMuted }]} numberOfLines={1}>
          {clinic.owner_email}
        </Text>
      </View>

      {/* View details */}
      <View style={styles.viewDetails}>
        <Text style={[styles.viewDetailsText, { color: theme.primary }]}>Dettagli</Text>
        <Ionicons name="chevron-forward" size={14} color={theme.primary} />
      </View>
    </TouchableOpacity>
  );
}

// === Detail Row Component ===
function DetailRow({ icon, label, value, theme, valueColor }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  theme: any;
  valueColor?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color={theme.textMuted} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.detailLabel, { color: theme.textMuted }]}>{label}</Text>
        <Text style={[styles.detailValue, { color: valueColor || theme.text }]}>{value}</Text>
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

  searchCard: {
    padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, height: 44, borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, height: '100%' },

  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16,
  },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 11, fontWeight: '600' },

  emptyBox: {
    padding: 40, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 12,
  },
  emptyText: { fontSize: 14, textAlign: 'center' },

  clinicsGrid: { gap: 12 },
  clinicsGridWide: { flexDirection: 'row', flexWrap: 'wrap' },

  clinicCard: {
    padding: 16, borderRadius: 14, borderWidth: 1,
  },
  clinicCardWide: { flexBasis: '48%', flexGrow: 1, maxWidth: '49%' },
  clinicHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  clinicIcon: {
    width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  clinicNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clinicName: { fontSize: 15, fontWeight: '700', flex: 1 },
  clinicCity: { fontSize: 12, marginTop: 2 },

  clinicStats: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  clinicStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clinicStatText: { fontSize: 12, fontWeight: '600' },
  availDot: { width: 6, height: 6, borderRadius: 3 },

  clinicOwner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, borderTopWidth: 1 },
  clinicOwnerText: { fontSize: 11, flex: 1 },

  viewDetails: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 10,
  },
  viewDetailsText: { fontSize: 12, fontWeight: '700' },

  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%', maxWidth: 600, maxHeight: '90%', borderRadius: 20, overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', flex: 1, marginRight: 12 },

  detailSection: { marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1 },
  detailSectionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 12 },
  detailRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  detailLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 13, fontWeight: '600', marginTop: 2 },

  descriptionText: { fontSize: 13, lineHeight: 20 },

  noRoomsText: { fontSize: 13, fontStyle: 'italic' },

  roomCard: { padding: 14, borderRadius: 12, borderWidth: 1 },
  roomHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  roomName: { fontSize: 14, fontWeight: '700' },
  roomStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  roomStatusDot: { width: 6, height: 6, borderRadius: 3 },
  roomStatusText: { fontSize: 10, fontWeight: '700' },
  roomDesc: { fontSize: 12, marginBottom: 8 },
  roomMeta: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  pricePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  priceText: { fontSize: 11, fontWeight: '700' },
  equipmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  equipTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  equipText: { fontSize: 10, fontWeight: '600' },
  equipMore: { fontSize: 10, fontWeight: '600', alignSelf: 'center' },
});
