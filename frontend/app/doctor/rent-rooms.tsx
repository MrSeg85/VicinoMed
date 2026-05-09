import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
  RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { api } from '../../src/api';
import { openExternal, mapsLink, whatsappLink } from '../../src/utils';

interface ClinicResult {
  clinic_id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  postal_code?: string;
  lat: number;
  lng: number;
  phone: string;
  whatsapp?: string;
  available_rooms: any[];
  rooms_available_count: number;
}

export default function RentRoomsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [results, setResults] = useState<ClinicResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [city, setCity] = useState('');
  const [mode, setMode] = useState<'hourly' | 'daily' | null>(null);
  const [maxPrice, setMaxPrice] = useState('');
  const [equipment, setEquipment] = useState('');

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (city.trim()) params.city = city.trim();
      if (mode) params.mode = mode;
      if (maxPrice && parseFloat(maxPrice) > 0) {
        if (mode === 'daily') params.max_daily = parseFloat(maxPrice);
        else params.max_hourly = parseFloat(maxPrice);
      }
      if (equipment.trim()) params.equipment = equipment.trim();
      const r = await api.get('/clinics/search', { params });
      setResults(r.data || []);
    } catch (e) { console.warn('[RentRooms] search fail', e); setResults([]); }
    finally { setLoading(false); setRefreshing(false); }
  }, [city, mode, maxPrice, equipment]);

  useEffect(() => { search(); }, []);

  const onRefresh = () => { setRefreshing(true); search(); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Affitta una stanza</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>Trova studi disponibili nella tua zona</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Filters */}
        <View style={[styles.filters, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.searchBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
            <Ionicons name="location-outline" size={18} color={theme.textSecondary} />
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Città (es. Milano, Roma)"
              placeholderTextColor={theme.textMuted}
              style={[styles.searchInput, { color: theme.text }]}
              onSubmitEditing={search}
              returnKeyType="search"
            />
          </View>

          <View style={styles.modeRow}>
            <ModeChip theme={theme} active={mode === null} label="Tutte" onPress={() => setMode(null)} />
            <ModeChip theme={theme} active={mode === 'hourly'} label="A ore" icon="time-outline" onPress={() => setMode(mode === 'hourly' ? null : 'hourly')} />
            <ModeChip theme={theme} active={mode === 'daily'} label="A giornata" icon="sunny-outline" onPress={() => setMode(mode === 'daily' ? null : 'daily')} />
          </View>

          <View style={styles.row}>
            <View style={[styles.smallInput, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
              <Ionicons name="cash-outline" size={16} color={theme.textSecondary} />
              <TextInput
                value={maxPrice}
                onChangeText={(v) => setMaxPrice(v.replace(',', '.').replace(/[^\d.]/g, ''))}
                placeholder={`Max € ${mode === 'daily' ? '/giorno' : '/ora'}`}
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.text, fontSize: 13 }]}
                keyboardType="decimal-pad"
                onSubmitEditing={search}
              />
            </View>
            <View style={[styles.smallInput, { backgroundColor: theme.surfaceAlt, borderColor: theme.border, flex: 1.2 }]}>
              <Ionicons name="hardware-chip-outline" size={16} color={theme.textSecondary} />
              <TextInput
                value={equipment}
                onChangeText={setEquipment}
                placeholder="Attrezzature (es. ECG)"
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.text, fontSize: 13 }]}
                onSubmitEditing={search}
              />
            </View>
          </View>

          <TouchableOpacity style={[styles.searchBtn, { backgroundColor: theme.primary }]} onPress={search}>
            <Ionicons name="search" size={18} color={theme.primaryFg} />
            <Text style={{ color: theme.primaryFg, fontWeight: '700', marginLeft: 6 }}>Cerca</Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
        ) : results.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="search-outline" size={42} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Nessuno studio trovato</Text>
            <Text style={[styles.emptyMsg, { color: theme.textSecondary }]}>
              Prova a modificare i filtri o cerca in un&apos;altra città.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.resultsCount, { color: theme.textSecondary }]}>
              {results.length} {results.length === 1 ? 'studio' : 'studi'} con stanze disponibili
            </Text>
            {results.map(c => (
              <View key={c.clinic_id} style={[styles.clinicCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.clinicHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clinicName, { color: theme.text }]} numberOfLines={1}>{c.name}</Text>
                    <Text style={[styles.clinicAddr, { color: theme.textSecondary }]} numberOfLines={1}>
                      {c.address}, {c.city}
                    </Text>
                  </View>
                  <View style={[styles.countBadge, { backgroundColor: theme.accent, borderColor: theme.primary }]}>
                    <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 16 }}>{c.rooms_available_count}</Text>
                    <Text style={{ color: theme.primary, fontSize: 10, fontWeight: '600' }}>STANZE</Text>
                  </View>
                </View>

                {c.available_rooms.slice(0, 3).map((room: any) => (
                  <View key={room.room_id} style={[styles.roomItem, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.roomName, { color: theme.text }]} numberOfLines={1}>{room.name}</Text>
                      {!!room.equipment?.length && (
                        <Text style={[styles.roomEq, { color: theme.textSecondary }]} numberOfLines={1}>
                          {room.equipment.join(' · ')}
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {room.rental_modes.includes('hourly') && (
                        <Text style={[styles.priceText, { color: theme.primary }]}>€{room.hourly_price?.toFixed(0)}<Text style={{ fontSize: 10, color: theme.textMuted }}>/h</Text></Text>
                      )}
                      {room.rental_modes.includes('daily') && (
                        <Text style={[styles.priceText, { color: theme.primary, fontSize: 13 }]}>€{room.daily_price?.toFixed(0)}<Text style={{ fontSize: 10, color: theme.textMuted }}>/g</Text></Text>
                      )}
                    </View>
                  </View>
                ))}
                {c.available_rooms.length > 3 && (
                  <Text style={[styles.moreText, { color: theme.textMuted }]}>+{c.available_rooms.length - 3} altre stanze</Text>
                )}

                <View style={styles.actionsRow}>
                  {c.lat && c.lng ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                      onPress={() => openExternal(mapsLink(c.lat, c.lng, c.name))}
                    >
                      <Ionicons name="map-outline" size={16} color={theme.text} />
                      <Text style={{ color: theme.text, fontWeight: '700', marginLeft: 6, fontSize: 13 }}>Mappa</Text>
                    </TouchableOpacity>
                  ) : null}
                  {c.phone || c.whatsapp ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: theme.whatsapp, borderColor: theme.whatsapp }]}
                      onPress={() => openExternal(whatsappLink(c.whatsapp || c.phone, `Salve, sono interessato/a ad affittare una stanza presso ${c.name}.`))}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color="#FFF" />
                      <Text style={{ color: '#FFF', fontWeight: '700', marginLeft: 6, fontSize: 13 }}>Contatta</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeChip({ theme, active, label, icon, onPress }: any) {
  return (
    <TouchableOpacity
      style={[
        styles.modeChip,
        { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary : theme.surface },
      ]}
      onPress={onPress}
    >
      {icon && <Ionicons name={icon} size={14} color={active ? theme.primaryFg : theme.text} />}
      <Text style={{ color: active ? theme.primaryFg : theme.text, fontWeight: '700', fontSize: 12, marginLeft: icon ? 4 : 0 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { padding: 40, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 1 },
  filters: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 48, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  modeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  modeChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 36, borderRadius: 999, borderWidth: 1.5 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  smallInput: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 44, gap: 6 },
  searchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 12, marginTop: 12 },
  resultsCount: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  empty: { padding: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginTop: 12 },
  emptyMsg: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  clinicCard: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  clinicHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  clinicName: { fontSize: 17, fontWeight: '800' },
  clinicAddr: { fontSize: 13, marginTop: 2 },
  countBadge: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, marginLeft: 10, minWidth: 60 },
  roomItem: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  roomName: { fontSize: 14, fontWeight: '700' },
  roomEq: { fontSize: 12, marginTop: 2 },
  priceText: { fontSize: 15, fontWeight: '800' },
  moreText: { fontSize: 12, marginTop: 4, textAlign: 'center', fontStyle: 'italic' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 38, borderRadius: 10, borderWidth: 1 },
});
