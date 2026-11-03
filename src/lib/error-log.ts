import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import { Linking, Platform } from 'react-native';

import '@/lib/local-storage';

/**
 * A short log of the app's recent errors, kept on the phone, so "Send feedback"
 * can put what went wrong into the email. Nothing is sent anywhere unless the
 * player sends that email themselves.
 */

export const FEEDBACK_EMAIL = 'thegauntletapp@gmail.com';

const STORAGE_KEY = 'gauntlet.error-log';
const MAX_ENTRIES = 10;
// Email apps cut off long mailto links, so keep the whole body well under that.
const MAX_STACK_CHARS = 1200;
const MAX_BODY_CHARS = 6000;

export type ErrorEntry = {
  at: string;
  /** Where it was caught: a screen that broke, an uncaught error, a failed promise. */
  where: string;
  message: string;
  stack?: string;
  /** The screen the player was on. */
  screen?: string;
};

let currentScreen: string | undefined;
let currentUserId: string | undefined;

/** Remember which screen and player errors happen on. */
export function setErrorContext(context: { screen?: string; userId?: string | null }) {
  if ('screen' in context) currentScreen = context.screen;
  if ('userId' in context) currentUserId = context.userId ?? undefined;
}

function readLog(): ErrorEntry[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recentErrors(): ErrorEntry[] {
  return readLog();
}

/** Add an error to the log. Never throws: this runs while something else is already broken. */
export function logError(error: unknown, where: string) {
  try {
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
    const entry: ErrorEntry = {
      at: new Date().toISOString(),
      where,
      message: err.message || String(error),
      stack: err.stack?.slice(0, MAX_STACK_CHARS),
      screen: currentScreen,
    };
    const log = [entry, ...readLog()].slice(0, MAX_ENTRIES);
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(log));
    if (__DEV__) console.warn(`[${where}]`, err);
  } catch {
    // Logging must never make things worse.
  }
}

export function clearErrorLog() {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}

type ErrorHandler = (error: unknown, isFatal?: boolean) => void;
type GlobalErrorUtils = { getGlobalHandler: () => ErrorHandler; setGlobalHandler: (h: ErrorHandler) => void };

let installed = false;

/**
 * Catch errors that happen outside drawing a screen (in a button press, a timer)
 * and log them before React Native's own handler runs.
 */
export function installGlobalErrorLogging() {
  if (installed || Platform.OS === 'web') return;
  installed = true;
  const errorUtils = (globalThis as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
  if (!errorUtils) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    logError(error, isFatal ? 'fatal error' : 'uncaught error');
    previous?.(error, isFatal);
  });
}

/** App, build and phone details for the feedback email. */
export function deviceSummary(): string {
  const lines = [
    `App version: ${Constants.expoConfig?.version ?? 'unknown'}`,
    `Update: ${Updates.isEmbeddedLaunch ? 'built in' : (Updates.updateId ?? 'unknown')}`,
    `Channel: ${Updates.channel ?? 'none'}`,
    `Phone: ${[Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || 'unknown'}`,
    `System: ${Platform.OS} ${Device.osVersion ?? Platform.Version}`,
  ];
  if (currentUserId) lines.push(`Player id: ${currentUserId}`);
  if (currentScreen) lines.push(`Screen: ${currentScreen}`);
  return lines.join('\n');
}

function describeEntry(e: ErrorEntry): string {
  const head = `${e.at} · ${e.where}${e.screen ? ` · on ${e.screen}` : ''}\n${e.message}`;
  return e.stack ? `${head}\n${e.stack}` : head;
}

/** The email body: room for the player's own words, then the details. */
export function feedbackBody(errors: ErrorEntry[] = recentErrors()): string {
  const top = 'What happened? (Write anything that helps, then press send.)\n\n\n\n--- Details for the developer ---\n';
  let body = `${top}${deviceSummary()}\n`;
  if (errors.length === 0) return `${body}\nNo errors logged.`;
  body += '\nRecent errors, newest first:\n';
  for (const e of errors) {
    const next = `\n${describeEntry(e)}\n`;
    if (body.length + next.length > MAX_BODY_CHARS) {
      body += '\n(older errors left out)';
      break;
    }
    body += next;
  }
  return body;
}

/** Open the player's email app with a message to us, filled in with the error details. */
export async function sendFeedback(subject = 'The Gauntlet feedback'): Promise<boolean> {
  const url = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(feedbackBody())}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
