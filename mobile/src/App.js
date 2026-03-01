import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { TabBar } from './components/TabBar';
import { Backdrop } from './components/Backdrop';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PlayScreen } from './screens/PlayScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SessionProvider, useSession } from './state/session';
import { I18nProvider, useI18n } from './state/i18n';
import { UiProvider, useUi } from './state/ui';
import { theme } from './theme';

function BrandSplash() {
  const { palette } = useUi();
  const { t } = useI18n();
  return (
    <LinearGradient
      colors={[palette.bg, palette.bgAlt, '#1E516F']}
      style={styles.splash}
    >
      <Text style={[styles.splashKicker, { color: palette.accent2 }]}>{t('app.splashKicker')}</Text>
      <Text style={styles.splashTitle}>PADELY</Text>
      <Text style={styles.splashSub}>{t('app.splashSub')}</Text>
    </LinearGradient>
  );
}

function Main() {
  const { token, user, hydrated, refreshProfile } = useSession();
  const { palette, setMode } = useUi();
  const { setLanguage } = useI18n();
  const [tab, setTab] = useState('home');
  const [booting, setBooting] = useState(true);
  const tabAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 1100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    tabAnim.setValue(0);
    Animated.timing(tabAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tab, tabAnim]);

  useEffect(() => {
    const appearance = user?.settings?.appearanceMode;
    if (appearance === 'day' || appearance === 'night') {
      setMode(appearance);
    }
  }, [user?.settings?.appearanceMode, setMode]);

  useEffect(() => {
    const language = user?.settings?.language;
    if (language === 'fr' || language === 'en') {
      setLanguage(language);
    }
  }, [user?.settings?.language, setLanguage]);

  useEffect(() => {
    if (!hydrated || !token) return;
    refreshProfile().catch(() => {});
  }, [hydrated, token]);

  if (booting || !hydrated) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]}>
        <BrandSplash />
      </SafeAreaView>
    );
  }

  if (!token || !user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]}>
        <AuthScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.bg }]}>
      <Backdrop />
      <Animated.View
        style={[
          styles.content,
          {
            opacity: tabAnim,
            transform: [{
              translateY: tabAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            }],
          },
        ]}
      >
        {tab === 'home' && <HomeScreen onNavigate={setTab} />}
        {tab === 'play' && <PlayScreen />}
        {tab === 'crew' && <CommunityScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </Animated.View>
      <TabBar active={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <UiProvider>
      <I18nProvider>
        <SessionProvider>
          <StatusBar style="light" />
          <Main />
        </SessionProvider>
      </I18nProvider>
    </UiProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    flex: 1,
  },
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  splashKicker: {
    color: theme.colors.accent2,
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  splashTitle: {
    color: '#E8F2F9',
    fontFamily: theme.fonts.display,
    fontSize: 64,
    lineHeight: 66,
  },
  splashSub: {
    color: '#C8DBE7',
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
});
