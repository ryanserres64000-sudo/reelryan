import { Component, useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fr } from "./copy/fr";
import { tokens } from "./design/tokens";

// When something breaks, the app shows what broke instead of closing (TestFlight, 28 octobre 2026:
// Ryan's first build would not open, with no way to tell why). A screenshot of this screen is enough to
// fix it. Plain React Native only, no theme and no fonts, since those may be what failed.
const c = tokens.color.light;
type Listener = (e: Error) => void;
const listeners = new Set<Listener>();
let last: Error | null = null;

// Errors outside rendering (a promise, a timer, a native call) end up here instead of closing the app.
const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void } };
if (g.ErrorUtils) {
  const previous = g.ErrorUtils.getGlobalHandler();
  g.ErrorUtils.setGlobalHandler((e, fatal) => {
    const err = e instanceof Error ? e : new Error(String(e));
    if (!fatal) { previous(e, fatal); return; }
    last = err;
    listeners.forEach(l => l(err));
  });
}

export function CrashScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.wrap}>
      <Text style={[styles.title, { color: c.text }]}>{fr.crash.title}</Text>
      <Text style={[styles.body, { color: c.textMuted }]}>{fr.crash.detail}</Text>
      <View style={[styles.box, { backgroundColor: c.surface }]}>
        <Text selectable style={[styles.code, { color: c.text }]}>{`${error.name}: ${error.message}\n\n${(error.stack ?? "").split("\n").slice(0, 12).join("\n")}`}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onRetry} style={[styles.button, { backgroundColor: c.action }]}>
        <Text style={[styles.label, { color: c.onAction }]}>{fr.crash.retry}</Text>
      </Pressable>
    </ScrollView>
  );
}

class Boundary extends Component<{ children: ReactNode; onError: (e: Error) => void }> {
  componentDidCatch(error: Error) { this.props.onError(error); }
  static getDerivedStateFromError() { return null; }
  render() { return this.props.children; }
}

// Wraps the whole app: rendering errors and fatal errors both land on the crash screen.
export function Guard({ children }: { children: ReactNode }) {
  const [error, setError] = useState<Error | null>(last);
  const [round, setRound] = useState(0);
  useEffect(() => { listeners.add(setError); return () => { listeners.delete(setError); }; }, []);
  if (error) return <CrashScreen error={error} onRetry={() => { last = null; setError(null); setRound(r => r + 1); }} />;
  return <Boundary key={round} onError={setError}>{children}</Boundary>;
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: "center", gap: tokens.space.md, padding: tokens.space.lg },
  title: { fontSize: tokens.type.headline.size, lineHeight: tokens.type.headline.lineHeight, fontWeight: "600" },
  body: { fontSize: tokens.type.callout.size, lineHeight: tokens.type.callout.lineHeight },
  box: { borderRadius: tokens.radius.card, padding: tokens.space.md },
  code: { fontSize: tokens.type.caption.size, lineHeight: tokens.type.caption.lineHeight, fontFamily: "Menlo" },
  button: { minHeight: tokens.size.button, borderRadius: tokens.radius.full, alignItems: "center", justifyContent: "center" },
  label: { fontSize: tokens.type.button.size, fontWeight: "600" },
});
