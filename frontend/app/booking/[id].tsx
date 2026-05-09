import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/useTheme';
import { useAuth } from '../../src/AuthContext';
import { api } from '../../src/api';
import { specialtyLabel } from '../../src/specialties';
import {
  formatDateLong, formatTime, openExternal, whatsappLink, mapsLink,
} from '../../src/utils';

export default function BookingConfirm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/bookings/me').then(r => {
      const b = r.data.find((x: any) => x.booking_id === id);
      setBooking(b);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }
  if (!booking) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.text }}>Prenotazione non trovata</Text>
      </SafeAreaView>
    );
  }

  const dt = new Date(booking.datetime_iso);
  const whatsappMsg = `🩺 *VicinoMed* - Conferma visita\n\n` +
    `Buongiorno, sono ${user?.name || 'il paziente'}.\n` +
    `Ho prenotato una visita di ${specialtyLabel(booking.specialty)} con ${booking.doctor_name}\n` +
    `📅 ${formatDateLong(dt)}\n` +
    `🕐 ${formatTime(dt)}\n` +
    `📍 ${booking.studio_name}\n${booking.studio_address}\n\n` +
    `Mappa: ${mapsLink(booking.studio_lat, booking.studio_lng)}\n\n` +
    `Grazie!`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Success */}
        <View style={[styles.successWrap, { backgroundColor: theme.secondary + '15' }]}>
          <View style={[styles.successCircle, { backgroundColor: theme.secondary }]}>
            <Ionicons name="checkmark" size={40} color={theme.secondaryFg} />
          </View>
          <Text style={[styles.successTitle, { color: theme.text }]}>Prenotazione confermata</Text>
          <Text style={[styles.successSub, { color: theme.textSecondary }]}>
            Ti abbiamo inviato i dettagli. Puoi gestire la visita da &quot;Le mie visite&quot;.
          </Text>
        </View>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.textMuted }]}>SPECIALISTA</Text>
          <Text style={[styles.value, { color: theme.text }]}>{booking.doctor_name}</Text>
          <Text style={[styles.subValue, { color: theme.textSecondary }]}>{specialtyLabel(booking.specialty)}</Text>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <Text style={[styles.label, { color: theme.textMuted }]}>DATA E ORA</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="calendar" size={18} color={theme.primary} />
            <Text style={[styles.value, { color: theme.text }]}>{formatDateLong(dt)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Ionicons name="time" size={18} color={theme.primary} />
            <Text style={[styles.value, { color: theme.text }]}>{formatTime(dt)}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <Text style={[styles.label, { color: theme.textMuted }]}>STUDIO</Text>
          <Text style={[styles.value, { color: theme.text }]}>{booking.studio_name}</Text>
          <Text style={[styles.subValue, { color: theme.textSecondary }]}>{booking.studio_address}</Text>

          <TouchableOpacity
            testID="confirm-maps"
            style={[styles.smallBtn, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
            onPress={() => openExternal(mapsLink(booking.studio_lat, booking.studio_lng, booking.studio_name))}
          >
            <Ionicons name="navigate" size={16} color={theme.primary} />
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13, marginLeft: 6 }}>Vedi su mappa</Text>
          </TouchableOpacity>
        </View>

        {/* WhatsApp */}
        {booking.doctor_phone && (
          <TouchableOpacity
            testID="confirm-whatsapp"
            style={[styles.whatsappBtn, { backgroundColor: theme.whatsapp }]}
            onPress={() => openExternal(whatsappLink(booking.doctor_phone, whatsappMsg))}
          >
            <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" />
            <Text style={styles.whatsappText}>Conferma su WhatsApp</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.note, { color: theme.textMuted }]}>
          🔔 Riceverai un promemoria 24h e 2h prima della visita.
        </Text>

        <View style={styles.bottomActions}>
          <TouchableOpacity
            testID="confirm-back-home"
            style={[styles.outlineBtn, { borderColor: theme.border }]}
            onPress={() => router.replace('/(tabs)/home')}
          >
            <Text style={{ color: theme.text, fontWeight: '600' }}>Torna alla Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="confirm-go-appointments"
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            onPress={() => router.replace('/(tabs)/appointments')}
          >
            <Text style={{ color: theme.primaryFg, fontWeight: '700' }}>Le mie visite</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  successWrap: { alignItems: 'center', padding: 24, borderRadius: 24, marginBottom: 16 },
  successCircle: {
    width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#00C48C', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  successTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  successSub: { fontSize: 14, textAlign: 'center', marginTop: 8, maxWidth: 320 },
  card: { padding: 20, borderRadius: 20, borderWidth: 1, gap: 6, marginBottom: 14 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
  value: { fontSize: 17, fontWeight: '700', marginTop: 4, textTransform: 'capitalize' as any },
  subValue: { fontSize: 13, marginTop: 2 },
  divider: { height: 1, marginVertical: 12 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
    height: 56, borderRadius: 16,
  },
  whatsappText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  bottomActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  outlineBtn: { flex: 1, height: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
