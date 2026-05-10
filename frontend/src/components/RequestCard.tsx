import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../useTheme';
import { formatDateShort, formatTime } from '../utils';

export interface RoomRequest {
  request_id: string;
  clinic_id: string;
  clinic_name: string;
  room_id: string;
  room_name: string;
  doctor_user_id: string;
  doctor_name: string;
  doctor_email: string;
  doctor_phone?: string;
  doctor_specialties: string[];
  doctor_photo?: string | null;
  rental_mode: 'hourly' | 'daily';
  start_iso: string;
  end_iso: string;
  hours?: number | null;
  days?: number | null;
  estimated_price: number;
  message?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  response_message?: string | null;
  created_at: string;
  responded_at?: string | null;
}

const STATUS_CONFIG = {
  pending:   { label: 'IN ATTESA', icon: 'time-outline'         as const, color: '#F59E0B' },
  accepted:  { label: 'ACCETTATA', icon: 'checkmark-circle'     as const, color: '#00C48C' },
  rejected:  { label: 'RIFIUTATA', icon: 'close-circle'         as const, color: '#EF4444' },
  cancelled: { label: 'ANNULLATA', icon: 'remove-circle-outline' as const, color: '#94A3B8' },
};

interface Props {
  request: RoomRequest;
  view: 'studio' | 'doctor';
  onAccept?: (req: RoomRequest) => void;
  onReject?: (req: RoomRequest) => void;
  onCancel?: (req: RoomRequest) => void;
}

export function RequestCard({ request, view, onAccept, onReject, onCancel }: Props) {
  const theme = useTheme();
  const cfg = STATUS_CONFIG[request.status];
  const start = new Date(request.start_iso);
  const isPending = request.status === 'pending';

  const confirm = (title: string, msg: string, onYes: () => void) => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm(`${title}\n\n${msg}`)) onYes();
    } else {
      Alert.alert(title, msg, [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Conferma', style: 'destructive', onPress: onYes },
      ]);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* Status pill (top right) */}
      <View style={[styles.statusPill, { backgroundColor: `${cfg.color}1A`, borderColor: cfg.color }]}>
        <Ionicons name={cfg.icon} size={12} color={cfg.color} />
        <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>

      {/* Header */}
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: theme.accent, borderColor: theme.primary }]}>
          <Ionicons
            name={view === 'studio' ? 'medical-outline' : 'business-outline'}
            size={22}
            color={theme.primary}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {view === 'studio' ? request.doctor_name : request.clinic_name}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {view === 'studio'
              ? (request.doctor_specialties?.length
                  ? request.doctor_specialties.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' · ')
                  : request.doctor_email)
              : request.room_name}
          </Text>
        </View>
      </View>

      {/* Details grid */}
      <View style={[styles.details, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
        <DetailRow theme={theme} icon="calendar-outline" label="Data" value={formatDateShort(start)} />
        <DetailRow
          theme={theme}
          icon={request.rental_mode === 'hourly' ? 'time-outline' : 'sunny-outline'}
          label={request.rental_mode === 'hourly' ? 'Ora & durata' : 'Inizio & giorni'}
          value={
            request.rental_mode === 'hourly'
              ? `${formatTime(start)} · ${request.hours}h`
              : `${formatTime(start)} · ${request.days} ${request.days === 1 ? 'giorno' : 'giorni'}`
          }
        />
        {view === 'doctor' && (
          <DetailRow theme={theme} icon="bed-outline" label="Stanza" value={request.room_name} />
        )}
        <DetailRow
          theme={theme}
          icon="cash-outline"
          label="Stimato"
          value={`€${request.estimated_price.toFixed(2)}`}
          highlight
        />
      </View>

      {/* Message from doctor */}
      {!!request.message && (
        <View style={[styles.messageBox, { borderColor: theme.border }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.messageText, { color: theme.textSecondary }]}>{request.message}</Text>
        </View>
      )}

      {/* Studio response message (if any) */}
      {!!request.response_message && (
        <View style={[styles.responseBox, { backgroundColor: `${cfg.color}10`, borderColor: cfg.color }]}>
          <Ionicons name="return-up-back-outline" size={14} color={cfg.color} />
          <Text style={[styles.messageText, { color: theme.text }]}>{request.response_message}</Text>
        </View>
      )}

      {/* Actions */}
      {isPending && view === 'studio' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.error }]}
            onPress={() => confirm('Rifiutare la richiesta?', 'Il medico verrà notificato del rifiuto.', () => onReject && onReject(request))}
          >
            <Ionicons name="close" size={18} color={theme.error} />
            <Text style={[styles.actionText, { color: theme.error }]}>Rifiuta</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.success, borderColor: theme.success }]}
            onPress={() => onAccept && onAccept(request)}
          >
            <Ionicons name="checkmark" size={18} color="#FFF" />
            <Text style={[styles.actionText, { color: '#FFF' }]}>Accetta</Text>
          </TouchableOpacity>
        </View>
      )}

      {isPending && view === 'doctor' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
            onPress={() => confirm('Annullare la richiesta?', 'La richiesta verrà ritirata.', () => onCancel && onCancel(request))}
          >
            <Ionicons name="trash-outline" size={18} color={theme.text} />
            <Text style={[styles.actionText, { color: theme.text }]}>Annulla richiesta</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Footer info */}
      <Text style={[styles.footer, { color: theme.textMuted }]}>
        Inviata il {formatDateShort(new Date(request.created_at))} alle {formatTime(new Date(request.created_at))}
      </Text>
    </View>
  );
}

function DetailRow({ theme, icon, label, value, highlight }: any) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={14} color={theme.textSecondary} />
      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: highlight ? theme.primary : theme.text, fontWeight: highlight ? '800' : '700' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 14, position: 'relative',
  },
  statusPill: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  head: { flexDirection: 'row', alignItems: 'center', marginRight: 90, marginBottom: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  details: { padding: 12, borderRadius: 12, borderWidth: 1, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLabel: { fontSize: 12, fontWeight: '600', flex: 1 },
  detailValue: { fontSize: 13 },
  messageBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderRadius: 0, marginTop: 10,
  },
  responseBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, marginTop: 10,
  },
  messageText: { fontSize: 13, lineHeight: 18, flexShrink: 1, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 42, borderRadius: 11, borderWidth: 1.5, gap: 6,
  },
  actionText: { fontSize: 14, fontWeight: '800' },
  footer: { fontSize: 11, marginTop: 10, fontStyle: 'italic' },
});
