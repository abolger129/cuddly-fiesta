import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { inviteLink } from '@/lib/invite';
import type { Group } from '@/lib/types';

/** Inviting friends: share a link that opens the app ready to join, or show a QR code to scan. */
export function InviteCard({ group }: { group: Pick<Group, 'name' | 'invite_code'> }) {
  const theme = useTheme();
  const [showQr, setShowQr] = useState(false);
  const link = inviteLink(group.invite_code);

  function share() {
    Share.share({
      message: `Join my league "${group.name}" on The Gauntlet: ${link}\n\nOr open the app and enter invite code ${group.invite_code}`,
    });
  }

  return (
    <View style={styles.card}>
      <View style={styles.actions}>
        <Button title="Share invite" variant="secondary" onPress={share} style={styles.action} />
        <Button
          title={showQr ? 'Hide QR code' : 'Show QR code'}
          variant="secondary"
          onPress={() => setShowQr((s) => !s)}
          style={styles.action}
        />
      </View>
      {showQr && (
        <View style={[styles.qrWrap, { borderColor: theme.text }]}>
          {/* Always dark on white, so every camera can read it. */}
          <View style={styles.qr} accessibilityLabel={`QR code to join ${group.name}`}>
            <QRCode value={link} size={200} color={Colors.light.text} backgroundColor="#FFFFFF" />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            Point a phone camera at this to join. Code {group.invite_code}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
    paddingHorizontal: Spacing.two,
  },
  qrWrap: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderRadius: Spacing.two,
  },
  qr: {
    padding: Spacing.three,
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.one,
  },
  centered: {
    textAlign: 'center',
  },
});
