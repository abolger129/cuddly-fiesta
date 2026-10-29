import { Alert, Platform } from 'react-native';

/** A message with an OK button. React Native's Alert does nothing in a browser. */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
