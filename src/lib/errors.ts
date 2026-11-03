import { showAlert } from '@/lib/alert';
import { logError } from '@/lib/error-log';

/** Show a database error to the user. Returns true if there was one. */
export function alertOnError(title: string, error: { message: string } | null): boolean {
  if (!error) return false;
  logError(new Error(error.message), title);
  showAlert(title, error.message);
  return true;
}
