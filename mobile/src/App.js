import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { TabBar } from './components/TabBar';
import { Backdrop } from './components/Backdrop';
import { AuthScreen } from './screens/AuthScreen';
import { HomeScreen } from './screens/HomeScreen';
import { PlayScreen } from './screens/PlayScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { SessionProvider, useSession } from './state/session';
import { theme } from './theme';

function Main() {
  const { token } = useSession();
  const [tab, setTab] = useState('home');

  if (!token) {
    return (
      <SafeAreaView style={styles.safe}>
        <AuthScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Backdrop />
      <View style={styles.content}>
        {tab === 'home' && <HomeScreen />}
        {tab === 'play' && <PlayScreen />}
        {tab === 'crew' && <CommunityScreen />}
        {tab === 'profile' && <ProfileScreen />}
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
