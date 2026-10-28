import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptic } from "../haptics";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { ThemeProvider, useTheme } from "../theme";

type Toast = { message: string; action?: string; onAction?: () => void };
const ToastContext = createContext<(t: Toast) => void>(() => {});

// « Annuler partout, sans peur » (étude de la refonte, décision 7): after each removal or big change,
// a dark pill at the bottom says what happened and offers to undo it for five seconds. One at a time;
// a new one replaces the last. VoiceOver reads it as it appears.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((t: Toast) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(null), tokens.motion.toast);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Always a dark pill: it reads on the light app and on the dark editor alike. */}
      {toast ? <ThemeProvider initial="dark"><ToastView key={toast.message + (toast.action ?? "")} toast={toast} onDone={() => { if (timer.current) clearTimeout(timer.current); setToast(null); }} /></ThemeProvider> : null}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

function ToastView({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const { motion, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => { Animated.spring(v, { toValue: 1, ...motion.spring, useNativeDriver: true }).start(); }, []);
  const { c } = useTheme();
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.place, { paddingBottom: insets.bottom + tokens.size.toastOffset }]}>
      <Animated.View accessibilityLiveRegion="polite" accessibilityRole="alert"
        style={[styles.toast, { backgroundColor: c.surfaceRaised, borderColor: c.line, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [tokens.space.lg, 0] }) }] }]}>
        <Text variant="callout" style={styles.flex} numberOfLines={2}>{toast.message}</Text>
        {toast.action ? (
          <Pressable accessibilityRole="button" hitSlop={tokens.space.xs} onPress={() => { haptic("tap"); toast.onAction?.(); onDone(); }} style={styles.action}>
            <Text variant="bodyStrong" tone="actionStrong">{toast.action}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  place: { justifyContent: "flex-end", alignItems: "center", paddingHorizontal: tokens.layout.gutter },
  toast: { flexDirection: "row", alignItems: "center", gap: tokens.space.md, minHeight: tokens.size.button, paddingHorizontal: tokens.space.md, borderRadius: tokens.radius.full, borderWidth: tokens.size.border, maxWidth: tokens.layout.largePhoneWidth, width: "100%" },
  flex: { flex: 1 },
  action: { minHeight: tokens.size.touch, justifyContent: "center" },
});
