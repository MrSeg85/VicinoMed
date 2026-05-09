import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions,
  ImageBackground, useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/useTheme';
import { Logo } from '../src/components/Logo';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: 'location' as const,
    title: 'Vicino a te',
    subtitle: 'Trova lo specialista più vicino con disponibilità immediata, ovunque tu sia in Italia.',
  },
  {
    icon: 'calendar' as const,
    title: 'Prenota in 3 tap',
    subtitle: 'Scegli il medico, lo studio e l\'orario. La prenotazione è confermata all\'istante.',
  },
  {
    icon: 'shield-checkmark' as const,
    title: 'Specialisti verificati',
    subtitle: 'Solo medici privati certificati, recensioni reali e profili completi per scelte sicure.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const theme = useTheme();
  const scheme = useColorScheme();
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList>(null);

  const finish = async () => {
    await AsyncStorage.setItem('vm_onboarded', '1');
    router.replace('/auth/login');
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      ref.current?.scrollToIndex({ index: index + 1, animated: true });
      setIndex(index + 1);
    } else finish();
  };

  const bgUrl = scheme === 'dark'
    ? 'https://static.prod-images.emergentagent.com/jobs/87af1e4f-10c1-4a17-877a-8e2aab082b6f/images/222d7292d2197a9c77adc880048d0de76d69d3fc61374819d3b8dfea4da4ad60.png'
    : 'https://static.prod-images.emergentagent.com/jobs/87af1e4f-10c1-4a17-877a-8e2aab082b6f/images/d11a3fe1529b954bc405b0209ec8cba02821aeb763d55fa2da2ec99704a1438f.png';

  return (
    <ImageBackground source={{ uri: bgUrl }} style={[styles.bg, { backgroundColor: theme.background }]} resizeMode="cover">
      <View style={[styles.overlay, { backgroundColor: scheme === 'dark' ? 'rgba(2,6,23,0.65)' : 'rgba(248,250,252,0.55)' }]}>
        <View style={styles.top}>
          <Logo size={64} />
          <TouchableOpacity onPress={finish} testID="onboarding-skip">
            <Text style={[styles.skip, { color: theme.textSecondary }]}>Salta</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={SLIDES}
          keyExtractor={(_, i) => i.toString()}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <View style={[styles.slide, { width }]}>
              <View style={[styles.iconWrap, { backgroundColor: theme.primary }]}>
                <Ionicons name={item.icon} size={56} color={theme.primaryFg} />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{item.subtitle}</Text>
            </View>
          )}
        />

        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === index ? theme.primary : theme.border, width: i === index ? 28 : 8 },
              ]}
            />
          ))}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.primary }]}
            onPress={next}
            testID="onboarding-next"
          >
            <Text style={[styles.btnText, { color: theme.primaryFg }]}>
              {index === SLIDES.length - 1 ? 'Inizia' : 'Avanti'}
            </Text>
            <Ionicons name="arrow-forward" size={20} color={theme.primaryFg} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
          <Text style={[styles.tagline, { color: theme.textMuted }]}>
            La visita specialistica più vicina a te.
          </Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, paddingTop: 60, paddingBottom: 40 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, marginBottom: 32 },
  skip: { fontSize: 15, fontWeight: '500' },
  slide: { paddingHorizontal: 32, alignItems: 'center', justifyContent: 'center', flex: 1 },
  iconWrap: {
    width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center',
    marginBottom: 40,
    shadowColor: '#0A3D62', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  title: { fontSize: 30, fontWeight: '700', textAlign: 'center', marginBottom: 16, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24, maxWidth: 360 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginVertical: 24, gap: 8 },
  dot: { height: 8, borderRadius: 4 },
  footer: { paddingHorizontal: 24 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 20 },
  btnText: { fontSize: 16, fontWeight: '700' },
  tagline: { fontSize: 13, textAlign: 'center', marginTop: 16, fontStyle: 'italic' },
});
