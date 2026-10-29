import { showAlert } from '@/lib/alert';

/** Show a database error to the user. Returns true if there was one. */
export function alertOnError(title: string, error: { message: string } | null): boolean {
  if (!error) return false;
  showAlert(title, error.message);
  return true;
}
