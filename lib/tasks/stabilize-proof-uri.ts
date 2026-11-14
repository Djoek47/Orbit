/**
 * ImagePicker URIs (ph://, content://, short-lived file://) can fail on read
 * a moment later. Copy into the app cache so upload always has a stable file.
 */
export async function stabilizeLocalProofUri(uri: string): Promise<string> {
  const trimmed = uri.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  try {
    const FileSystem = await import('expo-file-system/legacy');
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return trimmed;

    const extMatch = trimmed.match(/\.([a-z0-9]+)(?:\?|$)/i);
    const ext = (extMatch?.[1] || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const dest = `${cacheDir}proof-${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`;

    await FileSystem.copyAsync({ from: trimmed, to: dest });
    const info = await FileSystem.getInfoAsync(dest);
    if (info.exists && (info.size ?? 1) > 32) {
      return dest;
    }
  } catch (error) {
    console.warn('stabilizeLocalProofUri', error);
  }
  return trimmed;
}
