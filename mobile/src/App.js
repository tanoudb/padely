import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { NavigationContainer, DefaultTheme, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Icon } from './components/Icon';
import { AuthScreen } from './screens/AuthScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { PlayerProfileScreen } from './screens/PlayerProfileScreen';
import { PlaySetupScreen } from './screens/play/PlaySetupScreen';
import { PlayScoringScreen } from './screens/play/PlayScoringScreen';
import { PlayResultScreen } from './screens/play/PlayResultScreen';
import { SessionProvider, useSession } from './state/session';
import { I18nProvider, useI18n } from './state/i18n';
import { UiProvider, useUi } from './state/ui';
import { API_URL, api } from './api/client';
import { theme } from './theme';
import { createCommunitySubscription } from './utils/communityStream';
import { getPushDataFromNotification, registerForRealtimePush, resolvePushRoute } from './utils/pushRealtime';

const AuthStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const PlayStack = createNativeStackNavigator();
const CommunityStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function BrandSplash() {
  const { palette } = useUi();
  const { t } = useI18n();
  return (
    <View style={[styles.splash, { backgroundColor: palette.bg }]}>
      <Text style={[styles.splashKicker, { color: palette.accent }]}>PADELY</Text>
      <Text style={[styles.splashSub, { color: palette.textSecondary ?? palette.muted }]}>{t('app.splashSub')}</Text>
      <ActivityIndicator style={styles.spinner} color={palette.accent2} />
    </View>
  );
}

function stackScreenOptions(palette) {
  return {
    headerStyle: { backgroundColor: palette.bg },
    headerTintColor: palette.text,
    headerShadowVisible: false,
    headerTitleStyle: {
      fontFamily: theme.fonts.title,
      fontSize: 14,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    contentStyle: { backgroundColor: palette.bg },
  };
}

function HomeStackNavigator() {
  const { palette } = useUi();
  return (
    <HomeStack.Navigator screenOptions={stackScreenOptions(palette)}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
    </HomeStack.Navigator>
  );
}

function PlayStackNavigator() {
  const { palette } = useUi();
  return (
    <PlayStack.Navigator screenOptions={stackScreenOptions(palette)}>
      <PlayStack.Screen name="PlaySetup" component={PlaySetupScreen} options={{ title: 'Match' }} />
      <PlayStack.Screen name="PlayScoring" component={PlayScoringScreen} options={{ headerShown: false, gestureEnabled: false }} />
      <PlayStack.Screen name="PlayResult" component={PlayResultScreen} options={{ headerShown: false, gestureEnabled: false }} />
    </PlayStack.Navigator>
  );
}

function CommunityStackNavigator() {
  const { palette } = useUi();
  return (
    <CommunityStack.Navigator screenOptions={stackScreenOptions(palette)}>
      <CommunityStack.Screen name="CommunityMain" component={CommunityScreen} options={{ headerShown: false }} />
      <CommunityStack.Screen name="PlayerProfile" component={PlayerProfileScreen} options={{ title: 'Joueur' }} />
    </CommunityStack.Navigator>
  );
}

function ProfileStackNavigator() {
  const { palette } = useUi();
  return (
    <ProfileStack.Navigator screenOptions={stackScreenOptions(palette)}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} options={{ headerShown: false }} />
    </ProfileStack.Navigator>
  );
}

function isPlayImmersive(route) {
  const nested = getFocusedRouteNameFromRoute(route) ?? 'PlaySetup';
  return nested === 'PlayScoring' || nested === 'PlayResult';
}

function MainTabsNavigator({ communityBadgeCount, onCommunityFocus }) {
  const { palette } = useUi();
  const { t } = useI18n();
  const badgeLabel = communityBadgeCount > 99 ? '99+' : String(communityBadgeCount);

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: isPlayImmersive(route)
          ? { display: 'none' }
          : {
              backgroundColor: palette.bg,
              borderTopWidth: 0,
              elevation: 0,
              height: 78,
              paddingTop: 8,
              paddingBottom: 12,
            },
        tabBarItemStyle: {
          borderRadius: 0,
        },
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: {
          fontFamily: theme.fonts.title,
          fontSize: 10,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const map = {
            HomeTab: 'home',
            PlayTab: 'play',
            CommunityTab: 'crew',
            ProfileTab: 'profile',
          };
          return <Icon name={map[route.name]} active={focused} color={color} size={size + 2} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ tabBarLabel: t('tabs.home') }} />
      <Tab.Screen name="PlayTab" component={PlayStackNavigator} options={{ tabBarLabel: t('tabs.play') }} />
      <Tab.Screen
        name="CommunityTab"
        component={CommunityStackNavigator}
        listeners={{ focus: onCommunityFocus }}
        options={{
          tabBarLabel: t('tabs.social'),
          tabBarBadge: communityBadgeCount > 0 ? badgeLabel : undefined,
          tabBarBadgeStyle: {
            backgroundColor: palette.accent,
            color: palette.accentText,
            fontFamily: theme.fonts.title,
            fontSize: 10,
          },
        }}
      />
      <Tab.Screen name="ProfileTab" component={ProfileStackNavigator} options={{ tabBarLabel: t('tabs.profile') }} />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  const { palette } = useUi();
  return (
    <AuthStack.Navigator screenOptions={stackScreenOptions(palette)}>
      <AuthStack.Screen name="AuthMain" component={AuthScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Onboarding' }} />
    </AuthStack.Navigator>
  );
}

function MainRouter() {
  const { token, user, hydrated, refreshProfile } = useSession();
  const { palette, setMode } = useUi();
  const { setLanguage } = useI18n();
  const [booting, setBooting] = useState(true);
  const [communityBadgeCount, setCommunityBadgeCount] = useState(0);
  const lastPushTokenRef = useRef('');
  const navRef = useRef(null);
  const communityStreamRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setBooting(false), 900);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const appearance = user?.settings?.appearanceMode;
    if (appearance === 'day' || appearance === 'night') {
      setMode(appearance);
    }
  }, [setMode, user?.settings?.appearanceMode]);

  useEffect(() => {
    const language = user?.settings?.language;
    if (language === 'fr' || language === 'en') {
      setLanguage(language);
    }
  }, [setLanguage, user?.settings?.language]);

  useEffect(() => {
    if (!hydrated || !token) return;
    refreshProfile().catch(() => {});
  }, [hydrated, refreshProfile, token]);

  useEffect(() => {
    if (!token || !user?.id) {
      lastPushTokenRef.current = '';
      return;
    }

    async function syncPushToken() {
      const out = await registerForRealtimePush();
      if (!out.granted || !out.token || out.token === lastPushTokenRef.current) {
        return;
      }
      await api.updatePushToken(token, {
        token: out.token,
        platform: Platform.OS,
        appVersion: Constants?.expoConfig?.version ?? null,
      });
      lastPushTokenRef.current = out.token;
    }

    syncPushToken().catch(() => {});
  }, [token, user?.id]);

  useEffect(() => {
    if (!token || !user?.id) {
      setCommunityBadgeCount(0);
      if (communityStreamRef.current) {
        communityStreamRef.current();
        communityStreamRef.current = null;
      }
      return undefined;
    }

    let active = true;
    const syncUnread = async () => {
      try {
        const unread = await api.communityUnread(token);
        if (active) {
          setCommunityBadgeCount(Math.max(0, Number(unread?.totalUnread ?? 0)));
        }
      } catch {
        // Silent.
      }
    };

    syncUnread().catch(() => {});
    if (communityStreamRef.current) {
      communityStreamRef.current();
    }

    communityStreamRef.current = createCommunitySubscription({
      apiUrl: API_URL,
      token,
      onEvent: ({ data }) => {
        if (data?.unread) {
          setCommunityBadgeCount(Math.max(0, Number(data.unread.totalUnread ?? 0)));
        }
      },
      onFallbackPoll: (payload) => {
        setCommunityBadgeCount(Math.max(0, Number(payload?.totalUnread ?? 0)));
      },
      onError: () => {},
    });

    return () => {
      active = false;
      if (communityStreamRef.current) {
        communityStreamRef.current();
        communityStreamRef.current = null;
      }
    };
  }, [token, user?.id]);

  useEffect(() => {
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      setCommunityBadgeCount((prev) => Math.min(prev + 1, 99));
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = getPushDataFromNotification(response?.notification);
      const route = resolvePushRoute(data);
      if (route?.tab && navRef.current) {
        navRef.current.navigate(route.tab, route.params);
      }
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  const navTheme = useMemo(() => ({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: palette.bg,
      card: palette.bg,
      border: 'transparent',
      text: palette.text,
      primary: palette.accent,
      notification: palette.accent2,
    },
  }), [palette]);

  if (!hydrated || booting) {
    return <BrandSplash />;
  }

  return (
    <NavigationContainer
      ref={navRef}
      theme={navTheme}
    >
      {!token || !user ? (
        <AuthNavigator />
      ) : (
        <MainTabsNavigator
          communityBadgeCount={communityBadgeCount}
          onCommunityFocus={() => {
            api.communityUnread(token)
              .then((unread) => setCommunityBadgeCount(Math.max(0, Number(unread?.totalUnread ?? 0))))
              .catch(() => {});
          }}
        />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'DMSans-Regular': require('../assets/fonts/DMSans-Regular.ttf'),
    'DMSans-Medium': require('../assets/fonts/DMSans-Medium.ttf'),
    'DMSans-Bold': require('../assets/fonts/DMSans-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return <View style={styles.fontFallback} />;
  }

  return (
    <UiProvider>
      <I18nProvider>
        <SessionProvider>
          <StatusBar style="auto" />
          <MainRouter />
        </SessionProvider>
      </I18nProvider>
    </UiProvider>
  );
}

const styles = StyleSheet.create({
  fontFallback: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  splashKicker: {
    fontFamily: theme.fonts.display,
    fontSize: 52,
    letterSpacing: 8,
  },
  splashSub: {
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
  spinner: {
    marginTop: 8,
  },
});
