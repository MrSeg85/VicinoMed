import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { api } from '../../src/api';

export default function StudioProfile() {
  const theme = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [roomsCount, setRoomsCount] = useState('1');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [geoSuggestions, setGeoSuggestions] = useState<any[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/studio/me');
      const d = r.data;
      setName(d.name || '');
      setDescription(d.description || '');
      setAddress(d.address || '');
      setCity(d.city || '');
      setPostalCode(d.postal_code || '');
      setPhone(d.phone || '');
      setWhatsapp(d.whatsapp || '');
      setRoomsCount(String(d.rooms_count || 1));
      setLat(d.lat || null);
      setLng(d.lng || null);
    } catch (e) { console.warn('[StudioProfile] load fail', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onGeocode = async () => {
    if (!address.trim()) return;
    setGeoLoading(true);
    try {
      const r = await api.get('/geocode', { params: { q: `${address}, ${city || 'Italia'}` } });
      setGeoSuggestions(r.data || []);
    } catch { /* ignore */ } finally { setGeoLoading(false); }
  };

  const pickSuggestion = (s: any) => {
    setAddress(s.address || s.display_name);
    if (s.city) setCity(s.city);
    if (s.postal_code) setPostalCode(s.postal_code);
    setLat(s.lat); setLng(s.lng);
    setGeoSuggestions([]);
  };

  const onSave = async () => {
    if (!name.trim() || !address.trim() || !city.trim()) {
      setError('Compila i campi obbligatori (nome, indirizzo, città).'); return;
    }
    setSaving(true); setError(null);
    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim(),
        city: city.trim(),
        postal_code: postalCode.trim() || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        rooms_count: Math.max(1, parseInt(roomsCount) || 1),
      };
      if (lat !== null && lng !== null) { payload.lat = lat; payload.lng = lng; }
      await api.patch('/studio/me', payload);
      const ok = 'Profilo aggiornato!';
      if (Platform.OS === 'web') window.alert(ok); else Alert.alert('Successo', ok);
      router.back();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Errore salvataggio.');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.primary} size="large" />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Profilo studio</Text>
        <TouchableOpacity onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator color={theme.primary} /> : (
            <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '700' }}>Salva</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Label theme={theme} text="Nome studio *" />
          <Input theme={theme} value={name} onChangeText={setName} placeholder="Centro Medico ..." />

          <Label theme={theme} text="Descrizione" />
          <Input theme={theme} value={description} onChangeText={setDescription} multiline placeholder="Breve presentazione del tuo studio" />

          <Label theme={theme} text="Indirizzo *" />
          <View style={styles.row}>
            <Input theme={theme} value={address} onChangeText={setAddress} placeholder="Via, numero civico" style={{ flex: 1 }} />
            <TouchableOpacity
              style={[styles.geoBtn, { backgroundColor: theme.primary }]}
              onPress={onGeocode}
              disabled={geoLoading}
            >
              {geoLoading ? <ActivityIndicator color={theme.primaryFg} size="small" /> : <Ionicons name="search" size={20} color={theme.primaryFg} />}
            </TouchableOpacity>
          </View>
          {geoSuggestions.length > 0 && (
            <View style={[styles.suggestions, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {geoSuggestions.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.suggestion, { borderBottomColor: theme.border }]}
                  onPress={() => pickSuggestion(s)}
                >
                  <Ionicons name="location" size={16} color={theme.primary} />
                  <Text style={{ color: theme.text, flex: 1, marginLeft: 8, fontSize: 13 }} numberOfLines={2}>
                    {s.display_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.row}>
            <View style={{ flex: 2 }}>
              <Label theme={theme} text="Città *" />
              <Input theme={theme} value={city} onChangeText={setCity} placeholder="Milano" />
            </View>
            <View style={{ flex: 1 }}>
              <Label theme={theme} text="CAP" />
              <Input theme={theme} value={postalCode} onChangeText={setPostalCode} placeholder="20100" keyboardType="number-pad" />
            </View>
          </View>

          {lat !== null && lng !== null && lat !== 0 && (
            <View style={[styles.geoCard, { backgroundColor: theme.accent, borderColor: theme.primary }]}>
              <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
              <Text style={{ color: theme.primary, marginLeft: 8, fontSize: 12, fontWeight: '600' }}>
                Geolocalizzato: {lat.toFixed(4)}, {lng.toFixed(4)}
              </Text>
            </View>
          )}

          <Label theme={theme} text="Telefono" />
          <Input theme={theme} value={phone} onChangeText={setPhone} placeholder="+39 02 1234567" keyboardType="phone-pad" />

          <Label theme={theme} text="WhatsApp (se diverso)" />
          <Input theme={theme} value={whatsapp} onChangeText={setWhatsapp} placeholder="+39 ... (default: telefono)" keyboardType="phone-pad" />

          <Label theme={theme} text="Numero stanze totali" />
          <Input theme={theme} value={roomsCount} onChangeText={(v: string) => setRoomsCount(v.replace(/\D/g, ''))} keyboardType="number-pad" />

          {error && <Text style={[styles.error, { color: theme.error }]}>{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ theme, text }: any) {
  return <Text style={[styles.label, { color: theme.textSecondary }]}>{text}</Text>;
}
function Input({ theme, multiline, style, ...rest }: any) {
  return (
    <TextInput
      {...rest}
      multiline={multiline}
      style={[
        styles.input,
        { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
        multiline && { height: 90, textAlignVertical: 'top', paddingTop: 14 },
        style,
      ]}
      placeholderTextColor={theme.textMuted}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 50, fontSize: 15 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
  geoBtn: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  suggestions: { borderRadius: 12, borderWidth: 1, marginTop: 8 },
  suggestion: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  geoCard: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 10 },
  error: { fontSize: 13, marginTop: 12, textAlign: 'center' },
});
