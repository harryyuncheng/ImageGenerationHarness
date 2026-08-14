export type MutationOutcome<T> = { ok: true; value: T } | { ok: false };

export async function runMutation<T>(
  operation: () => Promise<T>,
  fallback: string,
  onError: (message: string) => void,
): Promise<MutationOutcome<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    onError(error instanceof Error ? error.message : fallback);
    return { ok: false };
  }
}
