import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Google Sign-In is a native module that isn't in Expo Go, so it's loaded lazily:
// the rest of the app (guest mode) still runs in Expo Go.
type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let google: GoogleModule | null = null;

function getGoogle(): GoogleModule {
  if (!google) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose (see above)
      google = require('@react-native-google-signin/google-signin') as GoogleModule;
    } catch {
      throw new Error('Google Sign-In needs a development build (it is not available in Expo Go).');
    }
    google.GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
  }
  return google;
}

/** Returns false when the user cancelled. Throws on real errors. */
export async function signInWithGoogle(): Promise<boolean> {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = getGoogle();
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (!isSuccessResponse(res)) return false;
    const idToken = res.data.idToken;
    if (!idToken) throw new Error('Google did not return an ID token. Check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw error;
    return true;
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) {
      return false;
    }
    throw e;
  }
}

export async function signInWithApple(): Promise<boolean> {
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!cred.identityToken) throw new Error('Apple did not return an identity token.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
    if (error) throw error;
    // Apple only sends the name on the very first sign-in; store it in user metadata.
    const fullName = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ');
    if (fullName) await supabase.auth.updateUser({ data: { full_name: fullName } });
    return true;
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }
}

export async function signOutProviders() {
  if (google) {
    try {
      await google.GoogleSignin.signOut();
    } catch {
      // not signed in with Google — ignore
    }
  }
}
