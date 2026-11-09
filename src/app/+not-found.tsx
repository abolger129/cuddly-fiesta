import { Redirect } from 'expo-router';

// Safety net: if the app is ever sent to a screen that doesn't exist, go home
// (or to sign-in when signed out) instead of showing "Unmatched Route".
export default function NotFound() {
  return <Redirect href="/" />;
}
