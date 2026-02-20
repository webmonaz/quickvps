export function shouldFetchNcduStatus(
  prevReady: boolean,
  ready: boolean,
  prevScanning: boolean,
  isScanning: boolean,
): boolean {
  if (!ready) {
    return false
  }
  if (!prevReady) {
    return true
  }
  if (isScanning && !prevScanning) {
    return true
  }
  return false
}
