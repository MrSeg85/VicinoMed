import { Linking, Platform } from 'react-native';

/** Format date in Italian (es: "Lun 15 Gen") */
const ITA_DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const ITA_MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const ITA_DAYS_FULL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const ITA_MONTHS_FULL = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

export function formatDay(d: Date) {
  return `${ITA_DAYS[d.getDay()]} ${d.getDate()}`;
}
export function formatDateShort(d: Date) {
  return `${ITA_DAYS[d.getDay()]} ${d.getDate()} ${ITA_MONTHS[d.getMonth()]}`;
}
export function formatDateLong(d: Date) {
  return `${ITA_DAYS_FULL[d.getDay()]} ${d.getDate()} ${ITA_MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}
export function formatTime(d: Date) {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function isoToLocalDate(iso: string): Date {
  return new Date(iso);
}

/** Build next 14 day Date objects starting today */
export function next14Days(): Date[] {
  const out: Date[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
  }
  return out;
}

export function dateToIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function combineDateAndTime(date: Date, time: string): string {
  const [h, m] = time.split(':');
  const d = new Date(date);
  d.setHours(parseInt(h), parseInt(m), 0, 0);
  return d.toISOString();
}

/** Open a URL safely on web/mobile */
export async function openExternal(url: string) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
  } else {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
  }
}

/** Build WhatsApp deep link with prefilled message */
export function whatsappLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/** Google Maps link */
export function mapsLink(lat: number, lng: number, label?: string): string {
  if (label) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}(${encodeURIComponent(label)})`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Build star string */
export function stars(rating: number, max = 5): string {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(max - full);
}

/** Italian capitalize */
export function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
