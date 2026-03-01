import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import { useI18n } from '../state/i18n';
import { useUi } from '../state/ui';

const TABS = [
  { key: 'home', i18n: 'tabs.home', icon: '◉' },
  { key: 'play', i18n: 'tabs.play', icon: '✦' },
  { key: 'crew', i18n: 'tabs.social', icon: '◎' },
  { key: 'profile', i18n: 'tabs.profile', icon: '◍' },
];

export function TabBar({ active, onChange }) {
  const { palette } = useUi();
  const { t } = useI18n();
  return (
    <View style={[styles.container, { backgroundColor: `${palette.bgAlt}EE`, borderTopColor: palette.line }]}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={[
              styles.button,
              {
                backgroundColor: palette.chip,
                borderColor: `${palette.line}AA`,
              },
              isActive && {
                backgroundColor: palette.accent,
                borderColor: palette.accent,
              },
            ]}
            onPress={() => onChange(tab.key)}
          >
            <Text style={[styles.icon, { color: isActive ? '#3A2500' : palette.muted }]}>{tab.icon}</Text>
            <Text style={[styles.label, { color: palette.text }, isActive && styles.labelActive]}>{t(tab.i18n)}</Text>
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
    borderTopWidth: 1,
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
    borderWidth: 1,
  },
  icon: { fontSize: 12, marginBottom: 2 },
  label: {
    fontFamily: theme.fonts.title,
    fontSize: 10,
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
