import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
  Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { useAuth } from '../../src/AuthContext';
import { api } from '../../src/api';
import { openExternal, mapsLink } from '../../src/utils';

interface Studio {
  studio_id: string; name: string; address: string; city: string;
  postal_code: string; phone: string; lat: number; lng: number;
}

const EMPTY_FORM = {
  name: '', address: '', city: '', postal_code: '', phone: '',
  lat: 0, lng: 0,
};

export default function StudiosScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Studio | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/doctor/me');
      setStudios(r.data?.studios || []);
    } catch (e) {
      console.warn('[Studios] load failed', e);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onDelete = (st: Studio) => {
    const doDelete = async () => {
      try {
        await api.delete(`/doctor/studios/${st.studio_id}`);
        load();
      } catch (e: any) {
        const msg = e?.response?.data?.detail || 'Errore eliminazione.';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Errore', msg);
      }
    };
    const ask = `Eliminare lo studio "${st.name}"? Le prenotazioni passate restano nello storico.`;
    if (Platform.OS === 'web') {
      if (window.confirm(ask)) doDelete();
    } else {
      Alert.alert('Elimina studio', ask, [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  if (user?.role !== 'doctor') {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background, padding: 24 }]}>
        <Ionicons name="medkit-outline" size={48} color={theme.textMuted} />
        <Text style={[styles.title, { color: theme.text, marginTop: 12 }]}>Solo per medici</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
        <TouchableOpacity testID="studios-back" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>I miei studi</Text>
        <TouchableOpacity testID="studios-add" onPress={() => setEditing('new')}>
          <Ionicons name="add-circle" size={28} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          {studios.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="business-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Nessuno studio</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                Aggiungi il tuo primo studio per iniziare a ricevere prenotazioni.
              </Text>
              <TouchableOpacity
                testID="studios-add-empty"
                style={[styles.btn, { backgroundColor: theme.primary, marginTop: 16 }]}
                onPress={() => setEditing('new')}
              >
                <Text style={[styles.btnText, { color: theme.primaryFg }]}>+ Aggiungi studio</Text>
              </TouchableOpacity>
            </View>
          ) : (
            studios.map((st) => (
              <View key={st.studio_id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, { backgroundColor: theme.accent }]}>
                    <Ionicons name="business" size={20} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: theme.text }]}>{st.name}</Text>
                    <Text style={[styles.cardAddr, { color: theme.textSecondary }]} numberOfLines={2}>
                      {st.address}, {st.city} ({st.postal_code})
                    </Text>
                    <View style={styles.cardMeta}>
                      <Ionicons name="call-outline" size={13} color={theme.textMuted} />
                      <Text style={{ color: theme.textMuted, fontSize: 12 }}> {st.phone}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <ActionBtn theme={theme} icon="navigate" label="Mappa" testID={`studio-map-${st.studio_id}`}
                    onPress={() => openExternal(mapsLink(st.lat, st.lng, st.name))} />
                  <ActionBtn theme={theme} icon="create" label="Modifica" testID={`studio-edit-${st.studio_id}`}
                    color={theme.primary} onPress={() => setEditing(st)} />
                  {studios.length > 1 && (
                    <ActionBtn theme={theme} icon="trash" label="Elimina" testID={`studio-delete-${st.studio_id}`}
                      color={theme.error} onPress={() => onDelete(st)} />
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <StudioFormModal
        visible={!!editing}
        theme={theme}
        initial={editing && editing !== 'new' ? editing : null}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    </SafeAreaView>
  );
}

function ActionBtn({ theme, icon, label, color, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={[styles.actBtn, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]} onPress={onPress}>
      <Ionicons name={icon} size={15} color={color || theme.text} />
      <Text style={{ color: color || theme.text, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ──────────── Form Modal ────────────
function StudioFormModal({
  visible, theme, initial, onClose, onSaved,
}: { visible: boolean; theme: any; initial: Studio | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    if (!visible) return;
    if (initial) {
      setForm({
        name: initial.name, address: initial.address, city: initial.city,
        postal_code: initial.postal_code, phone: initial.phone,
        lat: initial.lat, lng: initial.lng,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setError(null); setSuggestions([]);
  }, [visible, initial]);

  const set = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  const search = async () => {
    const q = `${form.address} ${form.city}`.trim();
    if (q.length < 4) {
      setError('Inserisci almeno via e città per cercare.');
      return;
    }
    setSearching(true); setError(null);
    try {
      const r = await api.get('/geocode', { params: { q } });
      setSuggestions(r.data || []);
      if ((r.data || []).length === 0) setError('Nessun risultato. Verifica l\'indirizzo.');
    } catch {
      setError('Errore nella ricerca indirizzo.');
    } finally { setSearching(false); }
  };

  const pickSuggestion = (s: any) => {
    set('address', s.address || form.address);
    set('city', s.city || form.city);
    set('postal_code', s.postal_code || form.postal_code);
    setForm(p => ({ ...p, lat: s.lat, lng: s.lng }));
    setSuggestions([]);
  };

  const valid = form.name.trim().length >= 2
    && form.address.trim().length >= 3
    && form.city.trim().length >= 2
    && /^\d{5}$/.test(form.postal_code.trim())
    && form.phone.trim().length >= 5
    && form.lat !== 0 && form.lng !== 0;

  const submit = async () => {
    if (!valid) {
      setError('Compila tutti i campi e geolocalizza l\'indirizzo.');
      return;
    }
    setBusy(true); setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        postal_code: form.postal_code.trim(),
        phone: form.phone.trim(),
        lat: form.lat, lng: form.lng,
      };
      if (initial) await api.patch(`/doctor/studios/${initial.studio_id}`, payload);
      else await api.post('/doctor/studios', payload);
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Errore salvataggio.');
    } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.modalCard, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={onClose} testID="studio-form-close">
              <Ionicons name="close" size={26} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.text }]}>
              {initial ? 'Modifica studio' : 'Nuovo studio'}
            </Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
            <Field theme={theme} label="Nome studio" placeholder="es. Studio Cardiologico Trastevere"
              testID="form-name" value={form.name} onChange={(v) => set('name', v)} />
            <Field theme={theme} label="Indirizzo" placeholder="es. Via della Lungaretta 45"
              testID="form-address" value={form.address} onChange={(v) => set('address', v)} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 2 }}>
                <Field theme={theme} label="Città" placeholder="es. Roma"
                  testID="form-city" value={form.city} onChange={(v) => set('city', v)} />
              </View>
              <View style={{ flex: 1 }}>
                <Field theme={theme} label="CAP" placeholder="00153" keyboardType="number-pad" maxLength={5}
                  testID="form-postal" value={form.postal_code} onChange={(v) => set('postal_code', v.replace(/\D/g, ''))} />
              </View>
            </View>
            <Field theme={theme} label="Telefono" placeholder="+39 06 1234567" keyboardType="phone-pad"
              testID="form-phone" value={form.phone} onChange={(v) => set('phone', v)} />

            {/* Geocode */}
            <TouchableOpacity
              testID="form-geocode"
              style={[styles.geocodeBtn, { backgroundColor: theme.accent, borderColor: theme.primary }]}
              onPress={search}
              disabled={searching}
            >
              {searching
                ? <ActivityIndicator color={theme.primary} size="small" />
                : <>
                    <Ionicons name="search" size={16} color={theme.primary} />
                    <Text style={{ color: theme.primary, fontWeight: '700', marginLeft: 8 }}>
                      Verifica indirizzo su mappa
                    </Text>
                  </>}
            </TouchableOpacity>

            {form.lat !== 0 && (
              <View style={[styles.coords, { backgroundColor: theme.success + '15', borderColor: theme.success + '40' }]} testID="form-coords">
                <Ionicons name="location" size={16} color={theme.success} />
                <Text style={{ color: theme.success, fontSize: 12, fontWeight: '600', marginLeft: 6 }}>
                  Posizione: {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
                </Text>
              </View>
            )}

            {suggestions.length > 0 && (
              <View style={[styles.sugList, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700', padding: 10, letterSpacing: 1 }}>
                  RISULTATI ({suggestions.length})
                </Text>
                {suggestions.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    testID={`sug-${i}`}
                    style={[styles.sugRow, { borderTopColor: theme.border }]}
                    onPress={() => pickSuggestion(s)}
                  >
                    <Ionicons name="location-outline" size={16} color={theme.primary} style={{ marginTop: 2 }} />
                    <Text style={{ color: theme.text, fontSize: 13, flex: 1, marginLeft: 8, lineHeight: 19 }} numberOfLines={2}>
                      {s.display_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {error && (
              <View style={[styles.errorBox, { backgroundColor: theme.error + '15', borderColor: theme.error }]}>
                <Ionicons name="alert-circle" size={16} color={theme.error} />
                <Text style={{ color: theme.error, fontSize: 13, marginLeft: 6, flex: 1 }}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              testID="form-submit"
              disabled={!valid || busy}
              style={[styles.btn, { backgroundColor: valid ? theme.primary : theme.surfaceAlt, marginTop: 8 }]}
              onPress={submit}
            >
              {busy
                ? <ActivityIndicator color={theme.primaryFg} />
                : <Text style={[styles.btnText, { color: valid ? theme.primaryFg : theme.textMuted }]}>
                    {initial ? 'Salva modifiche' : 'Aggiungi studio'}
                  </Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ theme, label, value, onChange, placeholder, testID, keyboardType, maxLength }: any) {
  return (
    <View>
      <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType={keyboardType}
        maxLength={maxLength}
        style={{
          backgroundColor: theme.surfaceAlt,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 12,
          padding: 14,
          color: theme.text,
          fontSize: 15,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  card: { padding: 16, borderRadius: 18, borderWidth: 1, gap: 14 },
  cardHeader: { flexDirection: 'row', gap: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 16, fontWeight: '700' },
  cardAddr: { fontSize: 13, marginTop: 4, lineHeight: 19 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  cardActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },

  btn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '700' },

  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' as any },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },

  geocodeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  coords: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1 },

  sugList: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  sugRow: { flexDirection: 'row', padding: 10, borderTopWidth: 1, alignItems: 'flex-start' },

  errorBox: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1 },
});
