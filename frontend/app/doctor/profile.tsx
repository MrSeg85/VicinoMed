import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
  Image, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { useAuth } from '../../src/AuthContext';
import { api } from '../../src/api';
import { specialtyLabel } from '../../src/specialties';

const TITLES = ['Dott.', 'Dott.ssa', 'Prof.', 'Prof.ssa'];
const COMMON_LANGUAGES = ['Italiano', 'Inglese', 'Francese', 'Tedesco', 'Spagnolo', 'Arabo', 'Cinese', 'Russo'];
const DAYS: { id: string; label: string }[] = [
  { id: 'mon', label: 'Lun' }, { id: 'tue', label: 'Mar' }, { id: 'wed', label: 'Mer' },
  { id: 'thu', label: 'Gio' }, { id: 'fri', label: 'Ven' }, { id: 'sat', label: 'Sab' }, { id: 'sun', label: 'Dom' },
];

export default function DoctorProfileEdit() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const [doctor, setDoctor] = useState<any>(null);
  const [allSpecialties, setAllSpecialties] = useState<{id: string; name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    try {
      const [me, spec] = await Promise.all([
        api.get('/doctor/me'),
        api.get('/specialties'),
      ]);
      // Normalize opening_hours
      const oh = me.data.opening_hours || {};
      DAYS.forEach(d => { if (!(d.id in oh)) oh[d.id] = ''; });
      setDoctor({ ...me.data, opening_hours: oh });
      setAllSpecialties(spec.data);
    } catch (e) {
      console.warn('[DoctorProfile] load error', e);
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const set = (k: string, v: any) => setDoctor((p: any) => ({ ...p, [k]: v }));
  const setOh = (day: string, v: string) => setDoctor((p: any) => ({ ...p, opening_hours: { ...p.opening_hours, [day]: v } }));

  const toggleSpecialty = (id: string) => {
    const cur = doctor.specialties || [];
    const next = cur.includes(id) ? cur.filter((x: string) => x !== id) : [...cur, id];
    set('specialties', next);
  };
  const toggleLanguage = (lang: string) => {
    const cur = doctor.languages || [];
    const next = cur.includes(lang) ? cur.filter((x: string) => x !== lang) : [...cur, lang];
    set('languages', next);
  };

  const save = async () => {
    setError(null); setSuccess(false);
    if (!doctor.name?.trim()) { setError('Il nome è obbligatorio.'); return; }
    if ((doctor.bio || '').length > 500) { setError('La bio non può superare 500 caratteri.'); return; }
    setSaving(true);
    try {
      const payload: any = {
        title: doctor.title,
        name: doctor.name.trim(),
        specialties: doctor.specialties || [],
        bio: (doctor.bio || '').trim(),
        photo: doctor.photo,
        price_from: Number(doctor.price_from) || 80,
        experience_years: Number(doctor.experience_years) || 0,
        languages: doctor.languages || ['Italiano'],
        opening_hours: doctor.opening_hours || {},
      };
      const r = await api.patch('/doctor/me', payload);
      setDoctor((p: any) => ({ ...r.data, opening_hours: r.data.opening_hours || p.opening_hours }));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2800);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Errore di salvataggio.');
    } finally { setSaving(false); }
  };

  if (user?.role !== 'doctor') {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text }}>Solo per medici</Text>
      </SafeAreaView>
    );
  }
  if (loading || !doctor) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  const bioCount = (doctor.bio || '').length;
  const selectedSpecs = doctor.specialties || [];
  const selectedLangs = doctor.languages || [];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
          <TouchableOpacity testID="profile-back" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Modifica profilo</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }}>
          {/* Photo + identity */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.photoRow}>
              <Image
                source={{ uri: doctor.photo || 'https://via.placeholder.com/120/0A3D62/FFFFFF?text=DR' }}
                style={[styles.photo, { borderColor: theme.border }]}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>FOTO PROFILO (URL)</Text>
                <TextInput
                  testID="profile-photo"
                  style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                  placeholder="https://..."
                  placeholderTextColor={theme.textMuted}
                  value={doctor.photo || ''}
                  onChangeText={(v) => set('photo', v)}
                  autoCapitalize="none"
                />
                <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 4 }}>
                  Suggerimento: usa una foto professionale 400×400px
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 14 }}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>TITOLO</Text>
              <View style={styles.chipsRow}>
                {TITLES.map(t => (
                  <Chip key={t} theme={theme} label={t} active={doctor.title === t} onPress={() => set('title', t)} testID={`profile-title-${t}`} />
                ))}
              </View>
            </View>

            <View style={{ marginTop: 14 }}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>NOME E COGNOME</Text>
              <TextInput
                testID="profile-name"
                style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                value={doctor.name || ''}
                onChangeText={(v) => set('name', v)}
                placeholder="es. Marco Bianchi"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>

          {/* Specialties */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Specializzazioni</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 10 }}>
              Seleziona una o più specializzazioni che pratichi.
            </Text>
            <View style={styles.chipsRow}>
              {allSpecialties.map(s => (
                <Chip key={s.id} theme={theme} label={s.name} active={selectedSpecs.includes(s.id)} onPress={() => toggleSpecialty(s.id)} testID={`profile-spec-${s.id}`} />
              ))}
            </View>
          </View>

          {/* Bio */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Bio / Presentazione</Text>
            <TextInput
              testID="profile-bio"
              style={[styles.textarea, { color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
              value={doctor.bio || ''}
              onChangeText={(v) => set('bio', v.slice(0, 500))}
              placeholder="Es: Cardiologo con 15 anni di esperienza, specializzato in ecocardiografia..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={{ color: bioCount > 480 ? theme.warning : theme.textMuted, fontSize: 11, textAlign: 'right', marginTop: 6 }}>
              {bioCount}/500
            </Text>
          </View>

          {/* Price + experience */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[styles.card, { flex: 1, backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Prezzo visita</Text>
              <View style={styles.euroRow}>
                <Text style={[styles.euro, { color: theme.text }]}>€</Text>
                <TextInput
                  testID="profile-price"
                  style={[styles.input, { flex: 1, color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                  value={String(doctor.price_from || '')}
                  onChangeText={(v) => set('price_from', v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  placeholder="80"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>
            <View style={[styles.card, { flex: 1, backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Esperienza</Text>
              <View style={styles.euroRow}>
                <TextInput
                  testID="profile-exp"
                  style={[styles.input, { flex: 1, color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                  value={String(doctor.experience_years || '')}
                  onChangeText={(v) => set('experience_years', v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  placeholder="10"
                  placeholderTextColor={theme.textMuted}
                />
                <Text style={[styles.euro, { color: theme.text, marginLeft: 8, fontSize: 13 }]}>anni</Text>
              </View>
            </View>
          </View>

          {/* Languages */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Lingue parlate</Text>
            <View style={styles.chipsRow}>
              {COMMON_LANGUAGES.map(l => (
                <Chip key={l} theme={theme} label={l} active={selectedLangs.includes(l)} onPress={() => toggleLanguage(l)} testID={`profile-lang-${l}`} />
              ))}
            </View>
          </View>

          {/* Opening hours */}
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Orari di apertura (informativi)</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 12 }}>
              Es: <Text style={{ fontWeight: '700' }}>09:00-13:00, 15:00-19:00</Text>. Lascia vuoto se chiuso.
            </Text>
            {DAYS.map(d => (
              <View key={d.id} style={styles.dayRow}>
                <View style={[styles.dayPill, { backgroundColor: theme.accent }]}>
                  <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 12 }}>{d.label}</Text>
                </View>
                <TextInput
                  testID={`profile-oh-${d.id}`}
                  style={[styles.input, { flex: 1, color: theme.text, backgroundColor: theme.surfaceAlt, borderColor: theme.border, marginLeft: 10 }]}
                  value={doctor.opening_hours?.[d.id] || ''}
                  onChangeText={(v) => setOh(d.id, v)}
                  placeholder="Chiuso"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            ))}
          </View>

          {/* Studios link */}
          <TouchableOpacity
            testID="profile-go-studios"
            style={[styles.linkBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
            onPress={() => router.push('/doctor/studios')}
          >
            <Ionicons name="business" size={20} color={theme.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: theme.text, fontWeight: '700' }}>Gestisci i tuoi studi</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                {(doctor.studios || []).length} studi configurati
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>

          {/* Patient preview card */}
          <View style={[styles.preview, { backgroundColor: theme.accent, borderColor: theme.primary }]}>
            <Text style={[styles.previewLabel, { color: theme.primary }]}>👁  ANTEPRIMA PER I PAZIENTI</Text>
            <View style={[styles.previewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Image source={{ uri: doctor.photo || 'https://via.placeholder.com/120/0A3D62/FFF?text=DR' }} style={styles.previewPhoto} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>
                    {doctor.title || 'Dott.'} {doctor.name}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
                    {selectedSpecs.length === 0 ? '— Specializzazioni non impostate —' : selectedSpecs.map(specialtyLabel).join(' · ')}
                  </Text>
                  <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '700', marginTop: 6 }}>
                    da €{doctor.price_from || '—'}
                  </Text>
                </View>
              </View>
              {doctor.bio ? (
                <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 10, lineHeight: 19 }} numberOfLines={3}>
                  {doctor.bio}
                </Text>
              ) : null}
            </View>
          </View>
        </ScrollView>

        {/* Sticky save bar */}
        <View style={[styles.saveBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          {error && (
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
              <Ionicons name="alert-circle" size={16} color={theme.error} />
              <Text style={{ color: theme.error, fontSize: 12, marginLeft: 6, flex: 1 }} numberOfLines={2}>{error}</Text>
            </View>
          )}
          {success && (
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
              <Ionicons name="checkmark-circle" size={18} color={theme.success} />
              <Text style={{ color: theme.success, fontSize: 13, fontWeight: '700', marginLeft: 6 }}>Profilo aggiornato</Text>
            </View>
          )}
          <TouchableOpacity
            testID="profile-save"
            style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.6 : 1 }]}
            onPress={save}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color={theme.primaryFg} />
              : <Text style={{ color: theme.primaryFg, fontWeight: '700' }}>Salva</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function Chip({ theme, label, active, onPress, testID }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: theme.border, backgroundColor: active ? theme.primary : theme.surfaceAlt },
      ]}
    >
      <Text style={{ color: active ? theme.primaryFg : theme.text, fontSize: 12, fontWeight: '600' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '700' },

  card: { padding: 16, borderRadius: 18, borderWidth: 1, gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },

  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14 },
  textarea: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, minHeight: 110 },
  euroRow: { flexDirection: 'row', alignItems: 'center' },
  euro: { fontSize: 18, fontWeight: '700', marginRight: 8 },

  photoRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  photo: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, backgroundColor: '#E2E8F0' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },

  dayRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dayPill: { width: 44, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },

  linkBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1 },

  preview: { padding: 14, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed' },
  previewLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  previewCard: { padding: 14, borderRadius: 14, borderWidth: 1 },
  previewPhoto: { width: 64, height: 64, borderRadius: 14, backgroundColor: '#E2E8F0' },

  saveBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center' },
  saveBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, minWidth: 120, alignItems: 'center' },
});
