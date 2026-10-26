/** Unwrap a Supabase result, throwing its error so loaders can show it. */
export function check<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}
