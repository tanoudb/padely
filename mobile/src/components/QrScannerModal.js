import React, { useEffect, useState } from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { theme } from '../theme';

export function QrScannerModal({
  visible,
  title = 'Scanner QR',
  subtitle = 'Cadre le QR code dans la zone.',
  onScan,
  onClose,
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (visible && !permission?.granted && permission?.canAskAgain !== false) {
      requestPermission().catch(() => {});
    }
  }, [visible, permission, requestPermission]);

  useEffect(() => {
    if (!visible) {
      setLocked(false);
    }
  }, [visible]);

  async function handleScanned(event) {
    if (locked) return;
    setLocked(true);
    try {
      const accepted = await onScan?.(event?.data ?? '');
      if (!accepted) {
        setTimeout(() => setLocked(false), 900);
      }
    } catch {
      setTimeout(() => setLocked(false), 900);
    }
  }

  const denied = permission && !permission.granted;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <View style={styles.topRow}>
          <Text style={styles.title}>{title}</Text>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Fermer</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.cameraFrame}>
          {denied ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>Camera non autorisee.</Text>
              <Pressable style={styles.retryBtn} onPress={() => requestPermission()}>
                <Text style={styles.retryBtnText}>Autoriser camera</Text>
              </Pressable>
            </View>
          ) : (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleScanned}
            />
          )}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.retryBtn} onPress={() => setLocked(false)}>
            <Text style={styles.retryBtnText}>Rescanner</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#07141F',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  topRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#F1F6FA',
    fontFamily: theme.fonts.display,
    fontSize: 32,
    lineHeight: 34,
  },
  subtitle: {
    color: '#A6C0D1',
    fontFamily: theme.fonts.body,
    fontSize: 13,
  },
  closeBtn: {
    minHeight: 36,
    borderRadius: 9,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A4A60',
  },
  closeBtnText: {
    color: '#E8F3FA',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  cameraFrame: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#38617A',
    backgroundColor: '#091B29',
  },
  camera: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#FFAD5A',
    fontFamily: theme.fonts.title,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  retryBtn: {
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A7288',
    backgroundColor: '#123247',
  },
  retryBtnText: {
    color: '#D9EDF9',
    fontFamily: theme.fonts.title,
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.6,
  },
});
