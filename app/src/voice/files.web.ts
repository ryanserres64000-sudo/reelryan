// On the web preview there is no file system: the voices stay in memory for the session.
const kept = new Map<string, string>();

export function saveVoice(name: string, base64: string): string {
  const uri = `data:audio/mpeg;base64,${base64}`;
  kept.set(name, uri);
  return uri;
}
export function keepRecording(name: string, uri: string): string { kept.set(name, uri); return uri; }
export const voiceUri = (name: string) => kept.get(name) ?? null;
