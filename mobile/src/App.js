import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { TabBar } from './components/TabBar';
import { Backdrop } from './components/Backdrop';
import { AuthScreen } from './screens/AuthScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PlayScreen } from './screens/PlayScreen';
import { StatsScreen } from './screens/StatsScreen';
import { SessionProvider, useSession } from './state/session';
import { theme } from './theme';

function Main() {
  const { token } = useSession();
  const [tab, setTab] = useState('home');

  if (!token) {
    return <AuthScreen />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Backdrop />
      <View style={styles.content}>
        {tab === 'home' && <HomeScreen />}
        {tab === 'play' && <PlayScreen />}
        {tab === 'community' && <CommunityScreen />}
        {tab === 'stats' && <StatsScreen />}
      </View>
      <TabBar active={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Main />
    </SessionProvider>
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
});
