import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Polygon, Stop } from 'react-native-svg';
import { useI18n } from '../state/i18n';
import { useUi } from '../state/ui';
import { theme } from '../theme';

const AXES = [
  { key: 'power', labelKey: 'profile.axisPower' },
  { key: 'stamina', labelKey: 'profile.axisStamina' },
  { key: 'clutch', labelKey: 'profile.axisClutch' },
  { key: 'consistency', labelKey: 'profile.axisConsistency' },
  { key: 'social', labelKey: 'profile.axisSocial' },
];

function pointsForRadar(values = [], size = 72) {
  const center = size / 2;
  const baseRadius = size * 0.42;
  return values.map((value, index) => {
    const angle = (-Math.PI / 2) + (index * 2 * Math.PI) / AXES.length;
    const radius = baseRadius * Math.max(0, Math.min(100, Number(value ?? 0))) / 100;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');
}

function tierColor(tier, palette) {
  const key = String(tier ?? '').toLowerCase();
  if (key === 'bronze') return palette.tierBronze ?? palette.warning;
  if (key === 'silver') return palette.tierSilver ?? palette.textSecondary;
  if (key === 'gold') return palette.tierGold ?? palette.accent2;
  if (key === 'mythic') return palette.tierMythic ?? palette.accent;
  return palette.lineStrong ?? palette.line;
}

export function PlayerCard({
  player,
  pir,
  rating,
  formScore,
  personality,
  type,
  pinnedBadges = [],
  pirDna = {},
  size = 'large',
}) {
  const { t } = useI18n();
  const { palette } = useUi();
  const isLarge = size !== 'compact';
  const cardStyles = useMemo(() => createStyles(palette, isLarge), [palette, isLarge]);

  const safePlayer = player ?? {};
  const displayName = safePlayer.displayName ?? t('profile.playerFallback');
  const arcadeTag = safePlayer.arcadeTag ?? t('profile.arcadeFallback');
  const safePir = Math.round(Number(pir ?? 0));
  const safeRating = Math.round(Number(rating ?? 0));
  const safeForm = Math.round(Number(formScore ?? 0));

  const radarValues = AXES.map((axis) => Number(pirDna?.[axis.key] ?? 45));
  const polygonPoints = pointsForRadar(radarValues, isLarge ? 84 : 64);

  return (
    <LinearGradient
      colors={[palette.accentDark, palette.accent]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={cardStyles.wrap}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[palette.cardGlass, palette.accentMuted]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={cardStyles.reflect}
      />

      <View style={cardStyles.header}>
        <View>
          <Text numberOfLines={1} style={cardStyles.name}>{displayName}</Text>
          <Text numberOfLines={1} style={cardStyles.tag}>{arcadeTag}</Text>
        </View>
        <View style={cardStyles.radarWrap}>
          <Svg width={isLarge ? 84 : 64} height={isLarge ? 84 : 64} viewBox={`0 0 ${isLarge ? 84 : 64} ${isLarge ? 84 : 64}`}>
            <Defs>
              <SvgLinearGradient id="dnaFill" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor={palette.accent2} stopOpacity="0.82" />
                <Stop offset="100%" stopColor={palette.accentLight} stopOpacity="0.62" />
              </SvgLinearGradient>
            </Defs>
            <Polygon points={polygonPoints} fill="url(#dnaFill)" stroke={palette.lineStrong ?? palette.line} strokeWidth="1.1" />
          </Svg>
        </View>
      </View>

      <View style={cardStyles.pirBlock}>
        <Text style={cardStyles.pirLabel}>{t('profile.pirLabel')}</Text>
        <Text style={cardStyles.pirValue}>{safePir}</Text>
      </View>

      <View style={cardStyles.metaRow}>
        <Text style={cardStyles.metaText}>{t('profile.formScoreMini', { score: safeForm })}</Text>
        <Text style={cardStyles.metaText}>{t('profile.ratingMini', { rating: safeRating })}</Text>
      </View>

      <View style={cardStyles.badgesRow}>
        {(pinnedBadges ?? []).slice(0, 3).map((badge) => (
          <View
            key={badge?.key ?? badge?.badgeKey ?? String(badge)}
            style={[
              cardStyles.badge,
              { borderColor: tierColor(badge?.tier, palette), backgroundColor: palette.cardGlass },
            ]}
          >
            <Text numberOfLines={1} style={cardStyles.badgeText}>{badge?.title ?? badge?.badgeKey ?? String(badge)}</Text>
          </View>
        ))}
      </View>

      <View style={cardStyles.footer}>
        <Text style={cardStyles.footerText}>{personality ? t(`profile.personality.${personality}`) : t('profile.personalityUnknown')}</Text>
        <Text style={cardStyles.footerText}>{type ? t(`profile.type.${type}`) : t('profile.type.regular')}</Text>
      </View>
    </LinearGradient>
  );
}

function createStyles(palette, isLarge) {
  return StyleSheet.create({
    wrap: {
      borderRadius: isLarge ? 24 : 18,
      padding: isLarge ? 16 : 12,
      minHeight: isLarge ? 360 : 200,
      justifyContent: 'space-between',
      overflow: 'hidden',
      shadowColor: palette.shadow,
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    reflect: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.18,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
    },
    name: {
      color: palette.accentText,
      fontFamily: theme.fonts.title,
      fontSize: isLarge ? 24 : 18,
      letterSpacing: 0.4,
    },
    tag: {
      marginTop: 2,
      color: palette.bgAlt,
      fontFamily: theme.fonts.body,
      fontSize: isLarge ? 12 : 10,
    },
    radarWrap: {
      borderRadius: 999,
      backgroundColor: palette.cardGlass,
      padding: isLarge ? 4 : 2,
    },
    pirBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    pirLabel: {
      color: palette.bgAlt,
      fontFamily: theme.fonts.title,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    pirValue: {
      color: palette.accent2,
      fontFamily: theme.fonts.display,
      fontSize: isLarge ? 52 : 38,
      lineHeight: isLarge ? 54 : 40,
      includeFontPadding: false,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 6,
    },
    metaText: {
      color: palette.bgAlt,
      fontFamily: theme.fonts.body,
      fontSize: isLarge ? 13 : 11,
    },
    badgesRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
      marginTop: 8,
    },
    badge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      maxWidth: isLarge ? '31%' : '48%',
    },
    badgeText: {
      color: palette.bgAlt,
      fontFamily: theme.fonts.title,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    footerText: {
      color: palette.bgAlt,
      fontFamily: theme.fonts.title,
      fontSize: 11,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
  });
}
