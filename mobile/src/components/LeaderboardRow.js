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

export function LeaderboardRow({ row, podium = false, onPress }) {
  const { palette } = useUi();
  const rating = Math.round(row?.rankingScore ?? row?.rating ?? 0);
  const badge = rankFromRating(rating);

  return (
    <Pressable
      disabled={!onPress}
      onPress={() => onPress?.(row)}
      style={[
        styles.row,
        {
          borderColor: palette.line,
          backgroundColor: podium ? `${palette.accent}1A` : palette.card,
        },
      ]}
    >
      <Text style={[styles.position, { color: row.rank <= 3 ? palette.accent : palette.muted }]}>
        {row.rank}
      </Text>
      <Avatar name={row.displayName} size="sm" rating={rating} />
      <View style={styles.middle}>
        <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>{row.displayName}</Text>
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
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
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
  name: {
    fontFamily: theme.fonts.title,
    fontSize: 14,
  },
  score: {
    fontFamily: theme.fonts.title,
    fontSize: 13,
  },
});
