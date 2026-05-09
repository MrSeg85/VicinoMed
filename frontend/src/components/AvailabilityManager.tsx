import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { next14Days, formatDay, dateToIsoDate, formatDateLong } from '../utils';

type SlotStatus = 'available' | 'blocked' | 'booked';
interface Slot { time: string; status: SlotStatus }
interface Studio { studio_id: string; name: string; city: string }

interface Props {
  studios: Studio[];
  theme: any;
}

export function AvailabilityManager({ studios, theme }: Props) {
  const days = useMemo(() => next14Days(), []);
  const [studioIdx, setStudioIdx] = useState(0);
  const [date, setDate] = useState<Date>(days[0]); // today by default
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);

  const studio = studios[studioIdx];

  const load = useCallback(async () => {
    if (!studio) return;
    setLoading(true);
    setSelected(new Set());
    try {
      const r = await api.get('/doctor/availability', {
        params: { studio_id: studio.studio_id, date: dateToIsoDate(date) },
      });
      setSlots(r.data.slots);
    } catch (e) {
      setSlots([]);
    } finally { setLoading(false); }
  }, [studio, date]);

  useEffect(() => { load(); }, [load]);

  const toggle = (t: string, status: SlotStatus) => {
    if (status === 'booked') return; // booked slots cannot be selected
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const selectAllAvailable = () => {
    setSelected(new Set(slots.filter(s => s.status === 'available').map(s => s.time)));
  };
  const selectAllBlocked = () => {
    setSelected(new Set(slots.filter(s => s.status === 'blocked').map(s => s.time)));
  };
  const clearSelection = () => setSelected(new Set());

  const selectedTimes = Array.from(selected);
  const selectedAreAllBlocked = selectedTimes.length > 0 && selectedTimes.every(t => slots.find(s => s.time === t)?.status === 'blocked');

  const blockSelected = async () => {
    if (selectedTimes.length === 0 || !studio) return;
    setBusy(true);
    try {
      await api.post('/doctor/blocks', {
        studio_id: studio.studio_id,
        date: dateToIsoDate(date),
        times: selectedTimes,
      });
      await load();
    } finally { setBusy(false); }
  };
  const unblockSelected = async () => {
    if (selectedTimes.length === 0 || !studio) return;
    setBusy(true);
    try {
      await api.request({
        method: 'DELETE',
        url: '/doctor/blocks',
        data: {
          studio_id: studio.studio_id,
          date: dateToIsoDate(date),
          times: selectedTimes,
        },
      });
      await load();
    } finally { setBusy(false); }
  };

  const counters = useMemo(() => {
    const av = slots.filter(s => s.status === 'available').length;
    const bk = slots.filter(s => s.status === 'booked').length;
    const bl = slots.filter(s => s.status === 'blocked').length;
    return { av, bk, bl };
  }, [slots]);

  return (
    <View>
      {/* Studio picker */}
      {studios.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.studioRow}>
          {studios.map((st, i) => (
            <TouchableOpacity
              key={st.studio_id}
              testID={`avail-studio-${i}`}
              style={[
                s.studioPill,
                { borderColor: theme.border, backgroundColor: i === studioIdx ? theme.primary : theme.surfaceAlt },
              ]}
              onPress={() => setStudioIdx(i)}
            >
              <Ionicons name="business-outline" size={14} color={i === studioIdx ? theme.primaryFg : theme.text} />
              <Text style={{ color: i === studioIdx ? theme.primaryFg : theme.text, fontWeight: '600', fontSize: 12 }}>
                {st.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Day strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayRow}>
        {days.map((d, i) => {
          const active = dateToIsoDate(d) === dateToIsoDate(date);
          return (
            <TouchableOpacity
              key={i}
              testID={`avail-day-${i}`}
              style={[
                s.dayCard,
                { borderColor: theme.border, backgroundColor: active ? theme.primary : theme.surfaceAlt },
              ]}
              onPress={() => setDate(d)}
            >
              <Text style={{ color: active ? theme.primaryFg : theme.textSecondary, fontSize: 11, fontWeight: '600' }}>
                {formatDay(d).split(' ')[0]}
              </Text>
              <Text style={{ color: active ? theme.primaryFg : theme.text, fontSize: 18, fontWeight: '800', marginTop: 2 }}>
                {d.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Date label + counters */}
      <View style={s.dateInfoRow}>
        <Text style={[s.dateLabel, { color: theme.text }]}>{formatDateLong(date)}</Text>
      </View>
      <View style={s.countersRow}>
        <Counter theme={theme} color={theme.success} icon="checkmark-circle" label="Liberi" value={counters.av} />
        <Counter theme={theme} color={theme.error} icon="close-circle" label="Bloccati" value={counters.bl} />
        <Counter theme={theme} color={theme.primary} icon="calendar" label="Prenotati" value={counters.bk} />
      </View>

      {/* Quick actions */}
      <View style={s.quickRow}>
        <TouchableOpacity
          testID="avail-select-all-free"
          style={[s.qaBtn, { borderColor: theme.border }]}
          onPress={selectAllAvailable}
        >
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>Sel. tutti liberi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="avail-select-all-blocked"
          style={[s.qaBtn, { borderColor: theme.border }]}
          onPress={selectAllBlocked}
        >
          <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>Sel. tutti bloccati</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="avail-range"
          style={[s.qaBtn, { borderColor: theme.primary, backgroundColor: theme.accent }]}
          onPress={() => setRangeOpen(true)}
        >
          <Ionicons name="time-outline" size={14} color={theme.primary} />
          <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}> Range</Text>
        </TouchableOpacity>
      </View>

      {/* Slots grid */}
      {loading ? (
        <ActivityIndicator color={theme.primary} style={{ marginVertical: 32 }} />
      ) : slots.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="moon-outline" size={42} color={theme.textMuted} />
          <Text style={[s.emptyText, { color: theme.textSecondary }]}>
            Studio chiuso in questo giorno (es. domenica)
          </Text>
        </View>
      ) : (
        <View style={s.slotGrid}>
          {slots.map((sl) => {
            const isSelected = selected.has(sl.time);
            return (
              <SlotChip
                key={sl.time}
                theme={theme}
                slot={sl}
                selected={isSelected}
                onPress={() => toggle(sl.time, sl.status)}
              />
            );
          })}
        </View>
      )}

      {/* Bottom action bar */}
      {selectedTimes.length > 0 && (
        <View style={[s.actionBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>
              {selectedTimes.length} slot selezionat{selectedTimes.length === 1 ? 'o' : 'i'}
            </Text>
            <TouchableOpacity onPress={clearSelection}>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>Annulla selezione</Text>
            </TouchableOpacity>
          </View>
          {selectedAreAllBlocked ? (
            <TouchableOpacity
              testID="avail-unblock"
              disabled={busy}
              style={[s.actionBtn, { backgroundColor: theme.success }]}
              onPress={unblockSelected}
            >
              {busy ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={s.actionText}> Sblocca</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="avail-block"
              disabled={busy}
              style={[s.actionBtn, { backgroundColor: theme.error }]}
              onPress={blockSelected}
            >
              {busy ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="close-circle" size={18} color="#fff" />
                  <Text style={s.actionText}> Blocca</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Range modal */}
      <RangeModal
        visible={rangeOpen}
        onClose={() => setRangeOpen(false)}
        onApply={(from, to) => {
          // Select all slots whose time is between from and to (inclusive)
          const next = new Set<string>();
          slots.forEach(sl => {
            if (sl.status !== 'booked' && sl.time >= from && sl.time <= to) next.add(sl.time);
          });
          setSelected(next);
          setRangeOpen(false);
        }}
        slots={slots.filter(sl => sl.status !== 'booked')}
        theme={theme}
      />
    </View>
  );
}

// ───── Sub-components ─────
function Counter({ theme, color, icon, label, value }: any) {
  return (
    <View style={[s.counter, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ color, fontWeight: '800', fontSize: 14 }}> {value}</Text>
      <Text style={{ color: theme.textSecondary, fontSize: 11, marginLeft: 4 }}>{label}</Text>
    </View>
  );
}

function SlotChip({
  theme, slot, selected, onPress,
}: { theme: any; slot: Slot; selected: boolean; onPress: () => void }) {
  const isBooked = slot.status === 'booked';
  const isBlocked = slot.status === 'blocked';

  let bg = theme.surfaceAlt;
  let border = theme.border;
  let textColor = theme.text;
  let icon: any = null;

  if (isBooked) {
    bg = theme.primary + '22';
    border = theme.primary + '44';
    textColor = theme.primary;
    icon = 'lock-closed';
  } else if (isBlocked) {
    bg = theme.error + '15';
    border = theme.error + '40';
    textColor = theme.error;
    icon = 'close-circle';
  } else {
    icon = 'checkmark-circle-outline';
  }

  if (selected) {
    bg = theme.text;
    border = theme.text;
    textColor = theme.background;
  }

  return (
    <TouchableOpacity
      testID={`avail-slot-${slot.time}`}
      onPress={onPress}
      disabled={isBooked}
      activeOpacity={isBooked ? 1 : 0.7}
      style={[s.slot, { backgroundColor: bg, borderColor: border, opacity: isBooked ? 0.85 : 1 }]}
    >
      {icon && <Ionicons name={icon} size={14} color={textColor} />}
      <Text style={{ color: textColor, fontWeight: '700', fontSize: 14 }}>{slot.time}</Text>
      {isBooked && <Text style={{ color: textColor, fontSize: 9, fontWeight: '600' }}>PRENOTATO</Text>}
    </TouchableOpacity>
  );
}

function RangeModal({
  visible, onClose, onApply, slots, theme,
}: { visible: boolean; onClose: () => void; onApply: (from: string, to: string) => void; slots: Slot[]; theme: any }) {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  useEffect(() => {
    if (visible) { setFrom(null); setTo(null); }
  }, [visible]);

  const times = slots.map(s => s.time);
  const validTo = from ? times.filter(t => t >= from) : times;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>Seleziona range orario</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 16 }}>
            Es. dalle 14:00 alle 16:00 → seleziona tutti gli slot in quell&apos;intervallo.
          </Text>

          <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>DALLE</Text>
          <View style={s.timeWrap}>
            {times.map(t => (
              <TouchableOpacity
                key={t}
                style={[s.timePill, { borderColor: theme.border, backgroundColor: from === t ? theme.primary : theme.surfaceAlt }]}
                onPress={() => { setFrom(t); if (to && t > to) setTo(null); }}
              >
                <Text style={{ color: from === t ? theme.primaryFg : theme.text, fontWeight: '600', fontSize: 13 }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: 6 }}>ALLE</Text>
          <View style={s.timeWrap}>
            {validTo.map(t => (
              <TouchableOpacity
                key={t}
                style={[s.timePill, { borderColor: theme.border, backgroundColor: to === t ? theme.primary : theme.surfaceAlt }]}
                onPress={() => setTo(t)}
              >
                <Text style={{ color: to === t ? theme.primaryFg : theme.text, fontWeight: '600', fontSize: 13 }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            testID="avail-range-apply"
            disabled={!from || !to}
            style={[s.applyBtn, { backgroundColor: from && to ? theme.primary : theme.surfaceAlt }]}
            onPress={() => from && to && onApply(from, to)}
          >
            <Text style={{ color: from && to ? theme.primaryFg : theme.textMuted, fontWeight: '700' }}>
              Conferma selezione
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  studioRow: { gap: 8, paddingBottom: 12 },
  studioPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  dayRow: { gap: 8, paddingVertical: 4 },
  dayCard: { width: 56, paddingVertical: 12, alignItems: 'center', borderRadius: 14, borderWidth: 1 },
  dateInfoRow: { marginTop: 14 },
  dateLabel: { fontSize: 14, fontWeight: '700', textTransform: 'capitalize' as any },
  countersRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  counter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },

  quickRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  qaBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },

  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  slot: {
    minWidth: 88, paddingVertical: 10, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 12, borderWidth: 1.5,
  },
  empty: { alignItems: 'center', padding: 28, gap: 8 },
  emptyText: { fontSize: 13, textAlign: 'center', marginTop: 8 },

  actionBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 16, padding: 14, borderRadius: 16, borderWidth: 1,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 480, padding: 20, borderRadius: 20, borderWidth: 1, maxHeight: Platform.OS === 'web' ? '85%' as any : '85%' as any },
  timeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timePill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  applyBtn: { marginTop: 20, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
