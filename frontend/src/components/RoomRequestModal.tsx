import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../useTheme';
import { api } from '../api';
import { next14Days, formatDay, formatDateLong, dateToIsoDate } from '../utils';

interface Room {
  room_id: string;
  name: string;
  rental_modes: ('hourly' | 'daily')[];
  hourly_price?: number | null;
  daily_price?: number | null;
  equipment?: string[];
}

interface Props {
  visible: boolean;
  clinicId: string;
  clinicName: string;
  room: Room | null;
  onClose: () => void;
  onSuccess: (request: any) => void;
  onError?: (msg: string) => void;
}

const HOURLY_DURATIONS = [1, 2, 3, 4, 6, 8];
const DAILY_DURATIONS = [1, 2, 3, 5, 7];
const HOUR_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];

export function RoomRequestModal({ visible, clinicId, clinicName, room, onClose, onSuccess, onError }: Props) {
  const theme = useTheme();
  const days = useMemo(() => next14Days(), []);

  const supportsHourly = !!room?.rental_modes?.includes('hourly');
  const supportsDaily = !!room?.rental_modes?.includes('daily');

  const [mode, setMode] = useState<'hourly' | 'daily'>(supportsHourly ? 'hourly' : 'daily');
  const [selectedDate, setSelectedDate] = useState<Date>(days[0]);
  const [selectedTime, setSelectedTime] = useState<string>('09:00');
  const [duration, setDuration] = useState<number>(2); // hours or days based on mode
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Reset state when room changes / modal opens
  React.useEffect(() => {
    if (visible && room) {
      const initialMode: 'hourly' | 'daily' = room.rental_modes.includes('hourly') ? 'hourly' : 'daily';
      setMode(initialMode);
      setSelectedDate(days[0]);
      setSelectedTime('09:00');
      setDuration(initialMode === 'hourly' ? 2 : 1);
      setMessage('');
      setErrorText(null);
      setSubmitting(false);
    }
  }, [visible, room, days]);

  if (!room) return null;

  const rate = mode === 'hourly' ? (room.hourly_price || 0) : (room.daily_price || 0);
  const estimatedPrice = rate * duration;

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorText(null);
    try {
      const isoDate = dateToIsoDate(selectedDate);
      const startIso = `${isoDate}T${selectedTime}:00.000Z`;
      const payload: any = {
        rental_mode: mode,
        start_iso: startIso,
        message: message.trim() || undefined,
      };
      if (mode === 'hourly') payload.hours = duration;
      else payload.days = duration;
      const r = await api.post(`/clinics/${clinicId}/rooms/${room.room_id}/request`, payload);
      onSuccess(r.data);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'Errore durante l\u2019invio della richiesta. Riprova.';
      setErrorText(typeof msg === 'string' ? msg : 'Errore sconosciuto.');
      if (onError) onError(typeof msg === 'string' ? msg : 'Errore sconosciuto.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          {/* Header */}
          <View style={[styles.head, { borderBottomColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text }]}>Invia richiesta</Text>
              <Text style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
                {clinicName} · {room.name}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
              <Ionicons name="close" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {/* Mode selector (only if both supported) */}
            {supportsHourly && supportsDaily && (
              <View style={styles.section}>
                <Text style={[styles.label, { color: theme.text }]}>Modalità</Text>
                <View style={styles.chipRow}>
                  <Chip
                    theme={theme}
                    active={mode === 'hourly'}
                    icon="time-outline"
                    label={`A ore · €${room.hourly_price?.toFixed(0) || '?'}/h`}
                    onPress={() => { setMode('hourly'); setDuration(2); }}
                  />
                  <Chip
                    theme={theme}
                    active={mode === 'daily'}
                    icon="sunny-outline"
                    label={`A giornata · €${room.daily_price?.toFixed(0) || '?'}/g`}
                    onPress={() => { setMode('daily'); setDuration(1); }}
                  />
                </View>
              </View>
            )}

            {/* Date selector */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.text }]}>Data</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                {days.map((d) => {
                  const active = selectedDate.toDateString() === d.toDateString();
                  return (
                    <TouchableOpacity
                      key={d.toISOString()}
                      onPress={() => setSelectedDate(d)}
                      style={[
                        styles.dateChip,
                        {
                          backgroundColor: active ? theme.primary : theme.surface,
                          borderColor: active ? theme.primary : theme.border,
                        },
                      ]}
                    >
                      <Text style={{ color: active ? theme.primaryFg : theme.textSecondary, fontSize: 11, fontWeight: '700' }}>
                        {formatDay(d).split(' ')[0].toUpperCase()}
                      </Text>
                      <Text style={{ color: active ? theme.primaryFg : theme.text, fontSize: 18, fontWeight: '800', marginTop: 2 }}>
                        {d.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Time selector */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.text }]}>{mode === 'hourly' ? 'Ora di inizio' : 'Orario di check-in'}</Text>
              <View style={styles.timeGrid}>
                {HOUR_SLOTS.map((t) => {
                  const active = selectedTime === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setSelectedTime(t)}
                      style={[
                        styles.timeChip,
                        {
                          backgroundColor: active ? theme.primary : theme.surface,
                          borderColor: active ? theme.primary : theme.border,
                        },
                      ]}
                    >
                      <Text style={{ color: active ? theme.primaryFg : theme.text, fontSize: 13, fontWeight: '700' }}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Duration */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.text }]}>
                {mode === 'hourly' ? 'Durata (ore)' : 'Numero di giorni'}
              </Text>
              <View style={styles.chipRow}>
                {(mode === 'hourly' ? HOURLY_DURATIONS : DAILY_DURATIONS).map((n) => {
                  const active = duration === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setDuration(n)}
                      style={[
                        styles.durChip,
                        {
                          backgroundColor: active ? theme.secondary : theme.surface,
                          borderColor: active ? theme.secondary : theme.border,
                        },
                      ]}
                    >
                      <Text style={{ color: active ? theme.secondaryFg : theme.text, fontSize: 14, fontWeight: '800' }}>
                        {n}{mode === 'hourly' ? 'h' : (n === 1 ? 'g' : 'gg')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Message */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: theme.text }]}>Messaggio (opzionale)</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Es. Sono cardiologo, mi servirebbe la stanza per visite ambulatoriali..."
                placeholderTextColor={theme.textMuted}
                multiline
                numberOfLines={3}
                maxLength={600}
                style={[styles.textarea, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              />
              <Text style={[styles.helper, { color: theme.textMuted }]}>{message.length}/600</Text>
            </View>

            {/* Summary */}
            <View style={[styles.summary, { backgroundColor: theme.accent, borderColor: theme.primary }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.summaryLabel, { color: theme.primary }]}>RIEPILOGO RICHIESTA</Text>
                <Text style={[styles.summaryText, { color: theme.text }]} numberOfLines={2}>
                  {formatDateLong(selectedDate)}
                </Text>
                <Text style={[styles.summaryDetail, { color: theme.textSecondary }]}>
                  {mode === 'hourly'
                    ? `dalle ${selectedTime} per ${duration} ${duration === 1 ? 'ora' : 'ore'}`
                    : `${selectedTime} · ${duration} ${duration === 1 ? 'giorno' : 'giorni'}`}
                </Text>
              </View>
              <View style={styles.priceBox}>
                <Text style={[styles.priceValue, { color: theme.primary }]}>€{estimatedPrice.toFixed(0)}</Text>
                <Text style={[styles.priceCaption, { color: theme.primary }]}>STIMATO</Text>
              </View>
            </View>

            {/* Error */}
            {!!errorText && (
              <View style={[styles.errBox, { backgroundColor: `${theme.error}15`, borderColor: theme.error }]}>
                <Ionicons name="alert-circle" size={18} color={theme.error} />
                <Text style={{ color: theme.error, flex: 1, fontSize: 13, fontWeight: '600' }}>{errorText}</Text>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: submitting ? theme.textMuted : theme.primary }]}
              onPress={submit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={theme.primaryFg} />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color={theme.primaryFg} />
                  <Text style={{ color: theme.primaryFg, fontSize: 15, fontWeight: '800', marginLeft: 8 }}>
                    Invia richiesta
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Chip({ theme, active, icon, label, onPress }: any) {
  return (
    <TouchableOpacity
      style={[
        styles.modeChip,
        { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.primary : theme.border },
      ]}
      onPress={onPress}
    >
      {icon && <Ionicons name={icon} size={15} color={active ? theme.primaryFg : theme.text} />}
      <Text style={{ color: active ? theme.primaryFg : theme.text, fontWeight: '700', fontSize: 13, marginLeft: icon ? 6 : 0 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0, overflow: 'hidden',
  },
  head: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, gap: 10,
  },
  title: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  section: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  modeChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 38,
    borderRadius: 999, borderWidth: 1.5,
  },
  dateChip: {
    width: 56, height: 64, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: {
    paddingHorizontal: 12, height: 36, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', minWidth: 64,
  },
  durChip: {
    paddingHorizontal: 16, height: 40, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', minWidth: 56,
  },
  textarea: {
    borderWidth: 1, borderRadius: 12, padding: 12,
    fontSize: 14, minHeight: 80, textAlignVertical: 'top',
  },
  helper: { fontSize: 11, marginTop: 4, textAlign: 'right' },
  summary: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 14, borderWidth: 1.5, marginBottom: 14, gap: 12,
  },
  summaryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  summaryText: { fontSize: 14, fontWeight: '700' },
  summaryDetail: { fontSize: 12, marginTop: 2 },
  priceBox: { alignItems: 'flex-end' },
  priceValue: { fontSize: 24, fontWeight: '900' },
  priceCaption: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  errBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, borderRadius: 14,
  },
});
