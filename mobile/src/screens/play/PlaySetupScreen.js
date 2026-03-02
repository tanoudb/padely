import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../api/client';
import { Card } from '../../components/Card';
import { QrScannerModal } from '../../components/QrScannerModal';
import { useI18n } from '../../state/i18n';
import { useSession } from '../../state/session';
import { useUi } from '../../state/ui';
import { theme } from '../../theme';

const LEVELS = [
  { key: 'beginner', rating: 900, labelKey: 'play.levelBeginner' },
  { key: 'intermediate', rating: 1100, labelKey: 'play.levelIntermediate' },
  { key: 'advanced', rating: 1350, labelKey: 'play.levelAdvanced' },
  { key: 'expert', rating: 1550, labelKey: 'play.levelExpert' },
];

function arcadeTagFromQrValue(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (value.startsWith('PADELY_ARCADE:')) {
    return value.slice('PADELY_ARCADE:'.length).trim();
  }
  if (value.startsWith('padely://arcade/')) {
    return decodeURIComponent(value.slice('padely://arcade/'.length)).trim();
  }
  return value;
}

export function PlaySetupScreen() {
  const navigation = useNavigation();
  const { token, user } = useSession();
  const { t } = useI18n();
  const { palette } = useUi();

  const [step, setStep] = useState(1);
  const [friends, setFriends] = useState([]);
  const [partner, setPartner] = useState(null);
  const [arcadeTagInput, setArcadeTagInput] = useState('');
  const [guestPartner, setGuestPartner] = useState('');
  const [opponentLevel, setOpponentLevel] = useState('intermediate');
  const [feedback, setFeedback] = useState('');
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    api.crew(token, user.city ?? '').then((out) => {
      setFriends(Array.isArray(out?.friends) ? out.friends : []);
    }).catch((e) => setFeedback(e.message));
  }, [token, user.city]);

  const partnerLabel = useMemo(() => {
    if (!partner) return t('play.partnerMissing');
    if (typeof partner === 'string') {
      const fromFriends = friends.find((item) => item.id === partner);
      return fromFriends?.displayName ?? t('play.partnerFound');
    }
    return partner.guestName;
  }, [friends, partner, t]);

  function pickFriend(friendId) {
    setPartner(friendId);
    setFeedback('');
  }

  function addGuestPartner() {
    const safeName = String(guestPartner ?? '').trim();
    if (!safeName) {
      setFeedback(t('play.partnerGuestRequired'));
      return;
    }
    setPartner({
      kind: 'guest',
      guestId: `guest_partner_${Date.now()}`,
      guestName: safeName,
      guestLevel: 'Intermediaire',
    });
    setGuestPartner('');
    setFeedback('');
  }

  async function addFromArcadeTag(tag) {
    const safeTag = String(tag ?? '').trim();
    if (!safeTag) {
      return;
    }
    try {
      const found = await api.arcadeSearch(token, safeTag);
      setPartner(found.id);
      setFeedback('');
      setArcadeTagInput('');
    } catch (e) {
      setFeedback(e.message);
    }
  }

  async function onScanPartnerQr(rawValue) {
    const tag = arcadeTagFromQrValue(rawValue);
    if (!tag) {
      setFeedback(t('play.invalidPartnerQr'));
      return false;
    }
    await addFromArcadeTag(tag);
    setQrOpen(false);
    return true;
  }

  function canNext() {
    if (step === 1) return Boolean(partner);
    if (step === 2) return Boolean(opponentLevel);
    return true;
  }

  function next() {
    if (!canNext()) {
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  }

  function previous() {
    setStep((current) => Math.max(1, current - 1));
  }

  function buildOpponentGuest(side, level) {
    const match = LEVELS.find((item) => item.key === level) ?? LEVELS[1];
    const guestLevel = level === 'beginner'
      ? 'Debutant'
      : level === 'intermediate'
        ? 'Intermediaire'
        : level === 'advanced'
          ? 'Confirme'
          : 'Expert';
    return {
      kind: 'guest',
      guestId: `anon_${side}_${Date.now()}`,
      guestName: t(`play.opponent${side}`),
      guestLevel,
      guestRating: match.rating,
    };
  }

  function launchMatch() {
    if (!partner) {
      setFeedback(t('play.partnerRequired'));
      return;
    }

    const levelConfig = LEVELS.find((item) => item.key === opponentLevel) ?? LEVELS[1];
    const opponentA = buildOpponentGuest('A', opponentLevel);
    const opponentB = buildOpponentGuest('B', opponentLevel);

    const partnerSlot = typeof partner === 'string'
      ? partner
      : {
        kind: 'guest',
        guestId: partner.guestId,
        guestName: partner.guestName,
        guestLevel: partner.guestLevel ?? 'Intermediaire',
      };

    const participants = {
      [user.id]: { displayName: user.displayName, rating: user.rating },
      [typeof partnerSlot === 'string' ? partnerSlot : partnerSlot.guestId]: typeof partnerSlot === 'string'
        ? { displayName: friends.find((item) => item.id === partnerSlot)?.displayName ?? t('play.partnerLabel'), rating: friends.find((item) => item.id === partnerSlot)?.rating ?? 1200 }
        : { displayName: partnerSlot.guestName, guestRating: 1100 },
      [opponentA.guestId]: { displayName: opponentA.guestName, guestRating: levelConfig.rating },
      [opponentB.guestId]: { displayName: opponentB.guestName, guestRating: levelConfig.rating },
    };

    navigation.navigate('PlayScoring', {
      setup: {
        userId: user.id,
        participants,
        selectedSlots: [partnerSlot, opponentA, opponentB],
        matchMode: 'anonymous',
        opponentLevel,
        confidenceMultiplier: 0.5,
        matchFormat: user.settings?.matchFormat ?? 'marathon',
        pointRule: user.settings?.pointRule ?? 'punto_de_oro',
        totalCostEur: 0,
      },
    });
  }

  const selectedLevel = LEVELS.find((item) => item.key === opponentLevel) ?? LEVELS[1];
  const formatKey = String(user.settings?.matchFormat ?? 'marathon');
  const formatLabel = formatKey === 'standard'
    ? t('home.standard')
    : formatKey === 'club'
      ? t('home.club')
      : t('home.marathon');

  return (
    <ScrollView style={[styles.root, { backgroundColor: palette.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: palette.text }]}>{t('play.setupTitle')}</Text>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{t('play.setupSubtitle')}</Text>

      <View style={styles.stepsRow}>
        {[1, 2, 3].map((value) => (
          <View key={String(value)} style={[styles.stepDot, { backgroundColor: value <= step ? palette.accent : palette.line }]} />
        ))}
      </View>

      {step === 1 ? (
        <Card elevated>
          <Text style={[styles.section, { color: palette.text }]}>{t('play.stepPartner')}</Text>
          <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('play.stepPartnerSub')}</Text>

          <View style={styles.wrap}>
            {friends.map((friend) => {
              const active = partner === friend.id;
              return (
                <Pressable
                  key={friend.id}
                  style={[styles.chip, { borderColor: active ? palette.accent : palette.line, backgroundColor: active ? palette.accentMuted : palette.bgAlt }]}
                  onPress={() => pickFriend(friend.id)}
                >
                  <Text style={[styles.chipText, { color: active ? palette.accent : palette.textSecondary }]}>{friend.displayName}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.row}>
            <TextInput
              value={arcadeTagInput}
              onChangeText={setArcadeTagInput}
              placeholder={t('play.arcadePlaceholder')}
              placeholderTextColor={palette.muted}
              style={[styles.input, styles.rowInput, { color: palette.text, borderColor: palette.line, backgroundColor: palette.bgAlt }]}
            />
            <Pressable style={[styles.smallBtn, { backgroundColor: palette.cardStrong }]} onPress={() => setQrOpen(true)}>
              <Text style={[styles.smallBtnText, { color: palette.text }]}>{t('play.scanQr')}</Text>
            </Pressable>
            <Pressable style={[styles.smallBtn, { backgroundColor: palette.accent }]} onPress={() => addFromArcadeTag(arcadeTagInput)}>
              <Text style={[styles.smallBtnText, { color: palette.accentText }]}>{t('play.addTag')}</Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <TextInput
              value={guestPartner}
              onChangeText={setGuestPartner}
              placeholder={t('play.partnerGuestPlaceholder')}
              placeholderTextColor={palette.muted}
              style={[styles.input, styles.rowInput, { color: palette.text, borderColor: palette.line, backgroundColor: palette.bgAlt }]}
            />
            <Pressable style={[styles.smallBtn, { backgroundColor: palette.cardStrong }]} onPress={addGuestPartner}>
              <Text style={[styles.smallBtnText, { color: palette.text }]}>{t('play.addGuest')}</Text>
            </Pressable>
          </View>

          <Text style={[styles.selected, { color: palette.accent }]}>{t('play.partnerSelected', { name: partnerLabel })}</Text>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card elevated>
          <Text style={[styles.section, { color: palette.text }]}>{t('play.stepLevel')}</Text>
          <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('play.stepLevelSub')}</Text>

          <View style={styles.levelWrap}>
            {LEVELS.map((item) => {
              const active = opponentLevel === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.levelBtn, { borderColor: active ? palette.accent : palette.line, backgroundColor: active ? palette.accentMuted : palette.bgAlt }]}
                  onPress={() => setOpponentLevel(item.key)}
                >
                  <Text style={[styles.levelTitle, { color: active ? palette.accent : palette.text }]}>{t(item.labelKey)}</Text>
                  <Text style={[styles.levelSub, { color: palette.textSecondary }]}>~ {item.rating}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.selected, { color: palette.warning }]}>{t('play.coeffInfo')}</Text>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card elevated>
          <Text style={[styles.section, { color: palette.text }]}>{t('play.stepSummary')}</Text>
          <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('play.summaryLineA', { partner: partnerLabel })}</Text>
          <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('play.summaryLineB', { level: t(selectedLevel.labelKey) })}</Text>
          <Text style={[styles.meta, { color: palette.textSecondary }]}>{t('play.summaryLineC', { format: formatLabel })}</Text>

          <Pressable style={[styles.launchBtn, { backgroundColor: palette.accent }]} onPress={launchMatch}>
            <Text style={[styles.launchBtnText, { color: palette.accentText }]}>{t('play.launchSimple')}</Text>
          </Pressable>
        </Card>
      ) : null}

      {!!feedback ? <Text style={[styles.feedback, { color: palette.danger }]}>{feedback}</Text> : null}

      <View style={styles.actions}>
        {step > 1 ? (
          <Pressable style={[styles.navBtn, { backgroundColor: palette.cardStrong }]} onPress={previous}>
            <Text style={[styles.navBtnText, { color: palette.text }]}>{t('onboarding.back')}</Text>
          </Pressable>
        ) : null}
        {step < 3 ? (
          <Pressable style={[styles.navBtn, { backgroundColor: canNext() ? palette.accent : palette.cardStrong }]} onPress={next}>
            <Text style={[styles.navBtnText, { color: canNext() ? palette.accentText : palette.textSecondary }]}>{t('onboarding.next')}</Text>
          </Pressable>
        ) : null}
      </View>

      <QrScannerModal
        visible={qrOpen}
        title={t('play.scanQr')}
        subtitle={t('play.scanPlayerQrSub')}
        onScan={onScanPartnerQr}
        onClose={() => setQrOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 28 },
  title: { fontFamily: theme.fonts.display, fontSize: 38, lineHeight: 40 },
  subtitle: { fontFamily: theme.fonts.body, fontSize: 13 },
  stepsRow: { flexDirection: 'row', gap: 8 },
  stepDot: { flex: 1, height: 6, borderRadius: 999 },
  section: { fontFamily: theme.fonts.title, fontSize: 15, marginBottom: 8 },
  meta: { fontFamily: theme.fonts.body, fontSize: 12, marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 10 },
  chipText: { fontFamily: theme.fonts.title, fontSize: 11 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  rowInput: { flex: 1 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontFamily: theme.fonts.body },
  smallBtn: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  smallBtnText: { fontFamily: theme.fonts.title, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  selected: { marginTop: 10, fontFamily: theme.fonts.title, fontSize: 12 },
  levelWrap: { gap: 8 },
  levelBtn: { borderWidth: 1, borderRadius: 14, minHeight: 62, paddingHorizontal: 12, justifyContent: 'center' },
  levelTitle: { fontFamily: theme.fonts.title, fontSize: 14 },
  levelSub: { fontFamily: theme.fonts.body, fontSize: 12, marginTop: 2 },
  launchBtn: { marginTop: 10, minHeight: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  launchBtnText: { fontFamily: theme.fonts.title, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  feedback: { fontFamily: theme.fonts.body, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  navBtn: { flex: 1, minHeight: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  navBtnText: { fontFamily: theme.fonts.title, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7 },
});
