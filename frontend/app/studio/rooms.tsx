import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
  Modal, KeyboardAvoidingView, Platform, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { api } from '../../src/api';

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

const EMPTY: Omit<Room, 'room_id'> = {
  name: '', description: '',
  equipment: [],
  rental_modes: ['hourly'],
  hourly_price: null, daily_price: null,
  available: true,
};

export default function RoomsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Room | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/studio/rooms');
      setRooms(r.data || []);
    } catch (e) { console.warn('[Rooms] load fail', e); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onDelete = (room: Room) => {
    const doDel = async () => {
      try {
        await api.delete(`/studio/rooms/${room.room_id}`);
        load();
      } catch (e: any) {
        const msg = e?.response?.data?.detail || 'Errore.';
        if (Platform.OS === 'web') window.alert(msg);
        else Alert.alert('Errore', msg);
      }
    };
    const ask = `Eliminare la stanza "${room.name}"?`;
    if (Platform.OS === 'web') { if (window.confirm(ask)) doDel(); }
    else Alert.alert('Conferma', ask, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: doDel },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Le mie stanze</Text>
        <TouchableOpacity onPress={() => setEditing('new')} style={[styles.iconBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]}>
          <Ionicons name="add" size={24} color={theme.primaryFg} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {rooms.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="layers-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Nessuna stanza</Text>
              <Text style={[styles.emptyMsg, { color: theme.textSecondary }]}>
                Aggiungi le stanze del tuo studio. Potrai impostare prezzi orari e giornalieri, attrezzature e disponibilità.
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                onPress={() => setEditing('new')}
              >
                <Ionicons name="add" size={18} color={theme.primaryFg} />
                <Text style={{ color: theme.primaryFg, fontWeight: '700', marginLeft: 6 }}>Aggiungi stanza</Text>
              </TouchableOpacity>
            </View>
          ) : rooms.map(room => (
            <View key={room.room_id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roomName, { color: theme.text }]}>{room.name}</Text>
                  <View style={styles.modesRow}>
                    {room.rental_modes.map(m => (
                      <View key={m} style={[styles.modeBadge, { backgroundColor: theme.accent, borderColor: theme.primary }]}>
                        <Ionicons name={m === 'hourly' ? 'time-outline' : 'sunny-outline'} size={12} color={theme.primary} />
                        <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '700', marginLeft: 4 }}>
                          {m === 'hourly' ? 'A ore' : 'A giornata'}
                        </Text>
                      </View>
                    ))}
                    {!room.available && (
                      <View style={[styles.modeBadge, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                        <Text style={{ color: theme.textMuted, fontSize: 11, fontWeight: '700' }}>NON DISP.</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <View style={styles.priceRow}>
                {room.rental_modes.includes('hourly') && (
                  <View style={[styles.priceBox, { backgroundColor: theme.surfaceAlt }]}>
                    <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>Orario</Text>
                    <Text style={[styles.priceValue, { color: theme.text }]}>€{room.hourly_price?.toFixed(0) ?? '—'}<Text style={{ fontSize: 12, color: theme.textMuted }}>/h</Text></Text>
                  </View>
                )}
                {room.rental_modes.includes('daily') && (
                  <View style={[styles.priceBox, { backgroundColor: theme.surfaceAlt }]}>
                    <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>Giornaliero</Text>
                    <Text style={[styles.priceValue, { color: theme.text }]}>€{room.daily_price?.toFixed(0) ?? '—'}<Text style={{ fontSize: 12, color: theme.textMuted }}>/g</Text></Text>
                  </View>
                )}
              </View>
              {!!room.equipment?.length && (
                <View style={styles.eqRow}>
                  {room.equipment.slice(0, 6).map(e => (
                    <View key={e} style={[styles.eqChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                      <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{e}</Text>
                    </View>
                  ))}
                </View>
              )}
              {!!room.description && (
                <Text style={[styles.desc, { color: theme.textSecondary }]} numberOfLines={2}>{room.description}</Text>
              )}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                  onPress={() => setEditing(room)}
                >
                  <Ionicons name="create-outline" size={16} color={theme.text} />
                  <Text style={{ color: theme.text, fontWeight: '700', marginLeft: 6, fontSize: 13 }}>Modifica</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.error }]}
                  onPress={() => onDelete(room)}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.error} />
                  <Text style={{ color: theme.error, fontWeight: '700', marginLeft: 6, fontSize: 13 }}>Elimina</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <RoomFormModal
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    </SafeAreaView>
  );
}

function RoomFormModal({ editing, onClose, onSaved }: {
  editing: Room | 'new' | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const theme = useTheme();
  const isOpen = editing !== null;
  const isNew = editing === 'new';
  const initial = (editing && editing !== 'new') ? editing : null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [equipmentInput, setEquipmentInput] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [hourly, setHourly] = useState(true);
  const [daily, setDaily] = useState(false);
  const [hourlyPrice, setHourlyPrice] = useState('');
  const [dailyPrice, setDailyPrice] = useState('');
  const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setDescription(initial.description || '');
      setEquipment(initial.equipment || []);
      setHourly(initial.rental_modes.includes('hourly'));
      setDaily(initial.rental_modes.includes('daily'));
      setHourlyPrice(initial.hourly_price?.toString() || '');
      setDailyPrice(initial.daily_price?.toString() || '');
      setAvailable(initial.available);
    } else if (isNew) {
      setName(''); setDescription(''); setEquipment([]); setEquipmentInput('');
      setHourly(true); setDaily(false);
      setHourlyPrice(''); setDailyPrice('');
      setAvailable(true);
    }
    setError(null);
  }, [editing, initial, isNew]);

  const addEquipment = () => {
    const v = equipmentInput.trim();
    if (!v) return;
    if (!equipment.includes(v)) setEquipment([...equipment, v]);
    setEquipmentInput('');
  };
  const removeEq = (e: string) => setEquipment(equipment.filter(x => x !== e));

  const onSave = async () => {
    if (!name.trim()) { setError('Inserisci il nome della stanza.'); return; }
    if (!hourly && !daily) { setError('Scegli almeno una modalità di affitto.'); return; }
    if (hourly && (!hourlyPrice || parseFloat(hourlyPrice) <= 0)) { setError('Imposta un prezzo orario valido.'); return; }
    if (daily && (!dailyPrice || parseFloat(dailyPrice) <= 0)) { setError('Imposta un prezzo giornaliero valido.'); return; }

    const payload: any = {
      name: name.trim(),
      description: description.trim() || null,
      equipment,
      rental_modes: [
        ...(hourly ? ['hourly'] : []),
        ...(daily ? ['daily'] : []),
      ],
      hourly_price: hourly ? parseFloat(hourlyPrice) : null,
      daily_price: daily ? parseFloat(dailyPrice) : null,
      available,
    };
    setSaving(true); setError(null);
    try {
      if (initial) {
        await api.patch(`/studio/rooms/${initial.room_id}`, payload);
      } else {
        await api.post('/studio/rooms', payload);
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Errore salvataggio.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={[styles.modalHead, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: theme.textSecondary, fontSize: 16 }}>Annulla</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {isNew ? 'Nuova stanza' : 'Modifica stanza'}
            </Text>
            <TouchableOpacity onPress={onSave} disabled={saving}>
              {saving ? <ActivityIndicator color={theme.primary} /> : (
                <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '700' }}>Salva</Text>
              )}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Label theme={theme} text="Nome stanza *" />
            <FormInput theme={theme} value={name} onChangeText={setName} placeholder="Es. Sala Cardiologia" />

            <Label theme={theme} text="Descrizione" />
            <FormInput theme={theme} value={description} onChangeText={setDescription} placeholder="Breve descrizione" multiline />

            <Label theme={theme} text="Modalità di affitto *" />
            <View style={styles.toggleRow}>
              <ToggleChip theme={theme} active={hourly} icon="time-outline" label="A ore" onPress={() => setHourly(!hourly)} />
              <ToggleChip theme={theme} active={daily} icon="sunny-outline" label="A giornata" onPress={() => setDaily(!daily)} />
            </View>

            {hourly && (
              <>
                <Label theme={theme} text="Prezzo orario (€) *" />
                <FormInput theme={theme} value={hourlyPrice} onChangeText={(v) => setHourlyPrice(v.replace(',', '.'))} placeholder="30" keyboardType="decimal-pad" />
              </>
            )}
            {daily && (
              <>
                <Label theme={theme} text="Prezzo giornaliero (€) *" />
                <FormInput theme={theme} value={dailyPrice} onChangeText={(v) => setDailyPrice(v.replace(',', '.'))} placeholder="200" keyboardType="decimal-pad" />
              </>
            )}

            <Label theme={theme} text="Attrezzatura" />
            <View style={[styles.eqInputRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <TextInput
                value={equipmentInput}
                onChangeText={setEquipmentInput}
                onSubmitEditing={addEquipment}
                placeholder="Es. ECG, Ecografo, Lettino..."
                placeholderTextColor={theme.textMuted}
                style={[styles.eqInput, { color: theme.text }]}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={addEquipment} style={[styles.eqAddBtn, { backgroundColor: theme.primary }]}>
                <Ionicons name="add" size={20} color={theme.primaryFg} />
              </TouchableOpacity>
            </View>
            {!!equipment.length && (
              <View style={[styles.eqRow, { marginTop: 8 }]}>
                {equipment.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.eqChipEdit, { backgroundColor: theme.accent, borderColor: theme.primary }]}
                    onPress={() => removeEq(e)}
                  >
                    <Text style={{ color: theme.primary, fontSize: 12 }}>{e}</Text>
                    <Ionicons name="close" size={14} color={theme.primary} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={[styles.switchRow, { borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: theme.text }]}>Disponibile per affitto</Text>
                <Text style={[styles.switchSub, { color: theme.textSecondary }]}>I medici potranno trovare e prenotare questa stanza</Text>
              </View>
              <Switch value={available} onValueChange={setAvailable} trackColor={{ true: theme.primary, false: theme.border }} />
            </View>

            {error && <Text style={[styles.error, { color: theme.error }]}>{error}</Text>}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function Label({ theme, text }: any) {
  return <Text style={[styles.label, { color: theme.textSecondary }]}>{text}</Text>;
}

function FormInput({ theme, multiline, ...rest }: any) {
  return (
    <TextInput
      {...rest}
      multiline={multiline}
      style={[
        styles.formInput,
        { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
        multiline && { height: 80, textAlignVertical: 'top', paddingTop: 14 },
      ]}
      placeholderTextColor={theme.textMuted}
    />
  );
}

function ToggleChip({ theme, active, icon, label, onPress }: any) {
  return (
    <TouchableOpacity
      style={[
        styles.toggleChip,
        { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary : theme.surface },
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={18} color={active ? theme.primaryFg : theme.text} />
      <Text style={{ color: active ? theme.primaryFg : theme.text, fontWeight: '700', marginLeft: 8 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: 1, gap: 12,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800' },
  empty: { padding: 32, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 12 },
  emptyMsg: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, height: 44, borderRadius: 12, marginTop: 16 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  roomName: { fontSize: 17, fontWeight: '800' },
  modesRow: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  modeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  priceRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  priceBox: { flex: 1, padding: 12, borderRadius: 12 },
  priceLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  priceValue: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  eqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  eqChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  desc: { fontSize: 13, marginTop: 10, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: 10, borderWidth: 1 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  formInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 50, fontSize: 15 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 12, borderWidth: 1.5 },
  eqInputRow: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, paddingLeft: 14, paddingRight: 4, alignItems: 'center', height: 50 },
  eqInput: { flex: 1, fontSize: 15 },
  eqAddBtn: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  eqChipEdit: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingVertical: 16, marginTop: 20 },
  switchTitle: { fontSize: 15, fontWeight: '700' },
  switchSub: { fontSize: 12, marginTop: 2 },
  error: { fontSize: 13, marginTop: 12, textAlign: 'center' },
});
