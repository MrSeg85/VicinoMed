import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions,
  ActivityIndicator, Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Slot, useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/AuthContext';
import { useTheme } from '../../src/useTheme';

const SIDEBAR_DARK = '#0F1F2E';
const SIDEBAR_DARK_HOVER = '#1A2D40';
const SIDEBAR_TEXT = '#A8B5C7';
const SIDEBAR_TEXT_ACTIVE = '#FFFFFF';
const SIDEBAR_ACCENT = '#0A3D62';
const SIDEBAR_BORDER = '#1F324A';

type NavItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
};

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'speedometer-outline', route: '/admin/dashboard' },
  { key: 'users',     label: 'Utenti',    icon: 'people-outline',      route: '/admin/users' },
  { key: 'clinics',   label: 'Studi',     icon: 'business-outline',    route: '/admin/clinics' },
  { key: 'analytics', label: 'Analytics', icon: 'bar-chart-outline',   route: '/admin/analytics' },
  { key: 'settings',  label: 'Impostazioni', icon: 'settings-outline', route: '/admin/settings' },
];

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Role guard: only admins
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth/login' as any);
    } else if (user.role !== 'admin') {
      router.replace('/(tabs)/home' as any);
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'admin') {
    return (
      <View style={[styles.gate, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} size="large" />
        <Text style={[styles.gateText, { color: theme.textSecondary }]}>
          {loading ? 'Caricamento...' : 'Accesso riservato all\u2019amministratore'}
        </Text>
      </View>
    );
  }

  const sidebarContent = (
    <View style={styles.sidebar}>
      {/* Brand */}
      <View style={styles.brand}>
        <View style={styles.logoBox}>
          <Ionicons name="medical" size={20} color="#FFF" />
        </View>
        <View>
          <Text style={styles.brandTitle}>VicinoMed</Text>
          <Text style={styles.brandSubtitle}>ADMIN PANEL</Text>
        </View>
      </View>

      {/* Nav */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 12 }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.route || pathname.startsWith(item.route + '/');
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, active && styles.navItemActive]}
              onPress={() => {
                router.push(item.route as any);
                setDrawerOpen(false);
              }}
            >
              <Ionicons
                name={item.icon}
                size={18}
                color={active ? SIDEBAR_TEXT_ACTIVE : SIDEBAR_TEXT}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
              {active && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* User block + Logout */}
      <View style={styles.userBlock}>
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <Ionicons name="shield-checkmark" size={18} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>{user.name || 'Admin'}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            await logout();
            router.replace('/auth/login' as any);
          }}
        >
          <Ionicons name="log-out-outline" size={16} color={SIDEBAR_TEXT} />
          <Text style={styles.logoutText}>Esci</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // === Desktop layout: fixed sidebar + content ===
  if (isDesktop) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        {sidebarContent}
        <View style={styles.contentDesktop}>
          <Slot />
        </View>
      </View>
    );
  }

  // === Mobile layout: top header + drawer ===
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={[styles.topbar, { backgroundColor: SIDEBAR_DARK }]}>
        <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.hamburger}>
          <Ionicons name="menu" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.topbarBrand}>
          <View style={[styles.logoBoxSmall]}>
            <Ionicons name="medical" size={14} color="#FFF" />
          </View>
          <Text style={styles.topbarTitle}>VicinoMed Admin</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ flex: 1 }}>
        <Slot />
      </View>

      {/* Drawer */}
      <Modal
        visible={drawerOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={styles.drawerBackdrop}>
          <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={() => setDrawerOpen(false)} />
          <View style={styles.drawerPanel}>
            {sidebarContent}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  gate: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  gateText: { fontSize: 13, marginTop: 4 },

  // Sidebar
  sidebar: {
    width: 256,
    backgroundColor: SIDEBAR_DARK,
    borderRightWidth: 1,
    borderRightColor: SIDEBAR_BORDER,
  },
  brand: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 20, borderBottomWidth: 1, borderBottomColor: SIDEBAR_BORDER,
  },
  logoBox: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: SIDEBAR_ACCENT, justifyContent: 'center', alignItems: 'center',
  },
  logoBoxSmall: {
    width: 26, height: 26, borderRadius: 6,
    backgroundColor: SIDEBAR_ACCENT, justifyContent: 'center', alignItems: 'center',
  },
  brandTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
  brandSubtitle: { color: SIDEBAR_TEXT, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 },

  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingVertical: 11,
    marginHorizontal: 10, marginVertical: 1, borderRadius: 10,
    position: 'relative',
  },
  navItemActive: { backgroundColor: SIDEBAR_DARK_HOVER },
  navLabel: { color: SIDEBAR_TEXT, fontSize: 14, fontWeight: '600', flex: 1 },
  navLabelActive: { color: SIDEBAR_TEXT_ACTIVE, fontWeight: '700' },
  activeIndicator: {
    position: 'absolute', left: -4, top: 8, bottom: 8, width: 3,
    backgroundColor: '#3B82F6', borderRadius: 2,
  },

  userBlock: { borderTopWidth: 1, borderTopColor: SIDEBAR_BORDER, padding: 14 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  userAvatar: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: SIDEBAR_ACCENT, justifyContent: 'center', alignItems: 'center',
  },
  userName: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  userEmail: { color: SIDEBAR_TEXT, fontSize: 11, marginTop: 1 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: SIDEBAR_BORDER,
  },
  logoutText: { color: SIDEBAR_TEXT, fontSize: 13, fontWeight: '600' },

  contentDesktop: { flex: 1 },

  // Mobile topbar
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  hamburger: {
    width: 40, height: 40, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  topbarBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topbarTitle: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', flexDirection: 'row' },
  drawerPanel: {
    width: 280, height: '100%' as any,
    ...Platform.select({ web: { boxShadow: '4px 0 20px rgba(0,0,0,0.3)' } as any }),
  },
});
