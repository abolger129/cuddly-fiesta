import { Platform, Share } from 'react-native';

import { showAlert } from '@/lib/alert';

/**
 * Share some text with the phone's share sheet. Most desktop browsers have no
 * share sheet, so there the text is copied to paste into the group chat instead.
 */
export async function shareText(message: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await Share.share({ message });
    return;
  }
  if (navigator.share) {
    try {
      await navigator.share({ text: message });
      return;
    } catch (e) {
      // Closing the share sheet isn't an error worth copying for.
      if ((e as Error).name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(message);
    showAlert('Copied', 'Paste it into your group chat.');
  } catch {
    showAlert('Could not copy', message);
  }
}
