import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './Avatar';
import { RankBadge } from './RankBadge';
import { useUi } from '../state/ui';
import { theme } from '../theme';

function rankFromRating(rating) {
  if (rating >= 2100) return 'Or I';
  if (rating >= 1800) return 'Argent II';
  if (rating >= 1500) return 'Argent I';
  if (rating >= 1400) return 'Bronze V';
  if (rating >= 1300) return 'Bronze IV';
  if (rating >= 1200) return 'Bronze II';
  return 'Bronze I';
}

export function LeaderboardRow({
  row,
  podium = false,
  onPress,
  isCurrentUser = false,
  currentUserLabel = 'You',
}) {
  const { palette } = useUi();
  const rating = Math.round(row?.rankingScore ?? row?.rating ?? 0);
  const badge = rankFromRating(rating);
  const isTopThree = Number(row?.rank ?? 99) <= 3;

  return (
    <Pressable
      disabled={!onPress}
      onPress={() => onPress?.(row)}
      style={[
        styles.row,
        {
          backgroundColor: isCurrentUser ? palette.accentMuted : (podium ? palette.cardStrong : palette.card),
          shadowColor: palette.shadow,
          shadowOpacity: podium || isCurrentUser ? 0.2 : 0.08,
        },
      ]}
    >
      <Text style={[styles.position, { color: isTopThree ? palette.accent : palette.muted }]}>
        {row.rank}
      </Text>
      <Avatar name={row.displayName} size="sm" rating={rating} />
      <View style={styles.middle}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>{row.displayName}</Text>
          {isCurrentUser ? (
            <View style={[styles.youBadge, { backgroundColor: palette.accent, shadowColor: palette.glow }]}>
              <Text style={[styles.youBadgeText, { color: palette.accentText }]}>{currentUserLabel}</Text>
            </View>
          ) : null}
        </View>
        <RankBadge rank={badge} size="sm" />
      </View>
      <Text style={[styles.score, { color: palette.text }]}>{rating} PIR</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 58,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  position: {
    width: 24,
    textAlign: 'center',
    fontFamily: theme.fonts.title,
    fontSize: 17,
  },
  middle: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
    fontFamily: theme.fonts.title,
    fontSize: 14,
  },
  youBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  youBadgeText: {
    fontFamily: theme.fonts.title,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  score: {
    fontFamily: theme.fonts.title,
    fontSize: 13,
  },
});
