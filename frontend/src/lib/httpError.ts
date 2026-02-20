interface ErrorPayload {
  error?: string
}

export async function readAPIError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as ErrorPayload
    if (typeof payload.error === 'string' && payload.error.trim() !== '') {
      return payload.error
    }
  } catch {
    // ignore parse errors
  }
  return fallback
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim() !== '') {
    return err.message
  }
  return fallback
}
