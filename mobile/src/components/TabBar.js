import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

const TABS = [
  { key: 'home', label: 'Accueil' },
  { key: 'play', label: 'Match' },
  { key: 'partners', label: 'Partenaires' },
  { key: 'stats', label: 'Stats' },
];

export function TabBar({ active, onChange }) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={[styles.button, isActive && styles.buttonActive]}
            onPress={() => onChange(tab.key)}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            {isActive ? <View style={styles.dot} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(11, 34, 49, 0.95)',
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
  },
  button: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.chip,
    borderWidth: 1,
    borderColor: 'rgba(41, 81, 105, 0.65)',
  },
  buttonActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  label: {
    color: theme.colors.text,
    fontFamily: theme.fonts.title,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  labelActive: {
    color: '#3A2500',
  },
  dot: {
    marginTop: 4,
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: '#3A2500',
  },
});
