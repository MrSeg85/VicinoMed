import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MapWebView } from '../../src/components/MapWebView';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { api } from '../../src/api';
import { specialtyLabel } from '../../src/specialties';
import { DoctorCard } from './home';

interface Doctor {
  doctor_id: string; name: string; title: string; specialties: string[];
  photo: string; rating: number; reviews_count: number; price_from: number;
  verified: boolean; studios: any[];
}

export default function Search() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; specialty?: string; view?: string; sort?: string }>();
  const [query, setQuery] = useState(params.q || '');
  const [activeSpec, setActiveSpec] = useState<string | undefined>(params.specialty);
  const [view, setView] = useState<'list' | 'map'>(params.view === 'map' ? 'map' : 'list');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/doctors', {
        params: {
          q: query || undefined,
          specialty: activeSpec || undefined,
        },
      });
      let list: Doctor[] = r.data;
      if (params.sort === 'rating') {
        list = [...list].sort((a, b) => b.rating - a.rating);
      }
      setDoctors(list);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, [query, activeSpec, params.sort]);

  useEffect(() => {
    api.get('/specialties').then((r) => setSpecialties(r.data));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Build map markers
  const markers = useMemo(() => {
    const out: { lat: number; lng: number; doctor_id: string; name: string; spec: string }[] = [];
    doctors.forEach((d) => {
      d.studios?.forEach((s: any) => {
        out.push({
          lat: s.lat, lng: s.lng,
          doctor_id: d.doctor_id,
          name: `${d.title} ${d.name}`,
          spec: d.specialties.map(specialtyLabel).join(', '),
        });
      });
    });
    return out;
  }, [doctors]);

  const mapHtml = useMemo(() => buildMapHtml(markers, theme), [markers, theme]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={[styles.searchHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={[styles.searchInput, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            testID="search-input"
            style={[styles.searchText, { color: theme.text }]}
            placeholder="Cerca medico, specializzazione, città..."
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={load}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            testID="search-view-list"
            style={[styles.toggle, view === 'list' && { backgroundColor: theme.primary }]}
            onPress={() => setView('list')}
          >
            <Ionicons name="list" size={16} color={view === 'list' ? theme.primaryFg : theme.text} />
            <Text style={[styles.toggleText, { color: view === 'list' ? theme.primaryFg : theme.text }]}>Elenco</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="search-view-map"
            style={[styles.toggle, view === 'map' && { backgroundColor: theme.primary }]}
            onPress={() => setView('map')}
          >
            <Ionicons name="map" size={16} color={view === 'map' ? theme.primaryFg : theme.text} />
            <Text style={[styles.toggleText, { color: view === 'map' ? theme.primaryFg : theme.text }]}>Mappa</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <TouchableOpacity
          testID="chip-all"
          style={[styles.chip, !activeSpec && { backgroundColor: theme.primary, borderColor: theme.primary }]}
          onPress={() => setActiveSpec(undefined)}
        >
          <Text style={{ color: !activeSpec ? theme.primaryFg : theme.text, fontWeight: '600', fontSize: 13 }}>Tutti</Text>
        </TouchableOpacity>
        {specialties.map((s) => (
          <TouchableOpacity
            key={s.id}
            testID={`chip-${s.id}`}
            style={[
              styles.chip,
              { borderColor: theme.border, backgroundColor: theme.surface },
              activeSpec === s.id && { backgroundColor: theme.primary, borderColor: theme.primary },
            ]}
            onPress={() => setActiveSpec(s.id)}
          >
            <Text style={{ color: activeSpec === s.id ? theme.primaryFg : theme.text, fontWeight: '600', fontSize: 13 }}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {view === 'map' ? (
        <View style={{ flex: 1 }}>
          <MapWebView
            html={mapHtml}
            style={{ flex: 1, backgroundColor: theme.background }}
            onMessage={(data) => {
              if (data.type === 'doctor' && data.doctor_id) {
                router.push(`/doctor/${data.doctor_id}`);
              }
            }}
          />
        </View>
      ) : loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
      ) : doctors.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="search" size={48} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Nessun risultato</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Prova con un&apos;altra ricerca o specializzazione.
          </Text>
        </View>
      ) : (
        <FlatList
          data={doctors}
          keyExtractor={(item) => item.doctor_id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <DoctorCard doctor={item} theme={theme} onPress={() => router.push(`/doctor/${item.doctor_id}`)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function buildMapHtml(markers: any[], theme: any): string {
  // center: Italy or first marker
  const center = markers.length ? [markers[0].lat, markers[0].lng] : [42.5, 12.5];
  const zoom = markers.length ? 6 : 6;
  const data = JSON.stringify(markers);
  const isDark = theme.background === '#020617';
  const tiles = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#m{height:100%;margin:0;background:${theme.background};} .pin{background:${theme.secondary};border:3px solid #fff;width:22px;height:22px;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.3);} .lbl{background:${theme.surface};color:${theme.text};padding:4px 8px;border-radius:8px;font-family:-apple-system,system-ui,sans-serif;font-size:12px;font-weight:600;border:1px solid ${theme.border};}</style>
</head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('m').setView([${center[0]}, ${center[1]}], ${zoom});
L.tileLayer('${tiles}', { attribution: '&copy; OSM &copy; CARTO', subdomains: 'abcd', maxZoom: 19 }).addTo(map);
var markers = ${data};
function send(payload){
  if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(JSON.stringify(payload));}
  else if(window.parent){window.parent.postMessage(JSON.stringify({__vm_map:true,payload:payload}),'*');}
}
window.__open=function(id){send({type:'doctor',doctor_id:id});return false;};
var icon = L.divIcon({ className: 'pin', iconSize: [22,22] });
markers.forEach(function(m){
  var marker = L.marker([m.lat,m.lng], { icon: icon }).addTo(map);
  marker.bindPopup('<div class="lbl"><b>'+m.name+'</b><br/>'+m.spec+'<br/><a href="#" onclick="return window.__open(\\''+m.doctor_id+'\\');">Vedi profilo →</a></div>');
});
if (markers.length > 1) {
  var grp = L.featureGroup(markers.map(function(m){ return L.marker([m.lat,m.lng]); }));
  map.fitBounds(grp.getBounds().pad(0.3));
}
</script></body></html>`;
}

const styles = StyleSheet.create({
  searchHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  searchInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, height: 50, borderRadius: 16, borderWidth: 1,
  },
  searchText: { flex: 1, fontSize: 15 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  toggleText: { fontSize: 13, fontWeight: '600' },
  chipsRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center', flexDirection: 'row' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
