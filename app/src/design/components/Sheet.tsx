import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fr } from "../../copy/fr";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { useTheme } from "../theme";

type Props = { visible: boolean; onClose: () => void; title?: string; children: ReactNode };

// A sheet that rises from the bottom over a dimmed screen (the « + », choices, the voice-over): it
// follows the finger when dragged down and closes past a threshold, or springs back. A tap on the dim
// background or VoiceOver's escape gesture closes it too.
export function Sheet({ visible, onClose, title, children }: Props) {
  const { c, motion, reduceMotion } = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState(visible);
  const y = useRef(new Animated.Value(height)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setShown(true);
      y.setValue(reduceMotion ? 0 : height);
      Animated.parallel([
        Animated.spring(y, { toValue: 0, ...motion.spring, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: motion.fast, useNativeDriver: true }),
      ]).start();
    } else if (shown) {
      Animated.parallel([
        Animated.timing(y, { toValue: reduceMotion ? 0 : height, duration: motion.fast, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: motion.fast, useNativeDriver: true }),
      ]).start(() => setShown(false));
    }
  }, [visible]);

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > tokens.space.xs && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (g.dy > tokens.size.dismissDrag || g.vy > 1) onClose();
      else Animated.spring(y, { toValue: 0, ...motion.spring, useNativeDriver: true }).start();
    },
  })).current;

  return (
    <Modal visible={shown} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={fr.nav.close} />
      </Animated.View>
      <Animated.View accessibilityViewIsModal onAccessibilityEscape={onClose}
        style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.line, paddingBottom: insets.bottom + tokens.space.md, transform: [{ translateY: y }] }]}>
        <View {...pan.panHandlers} style={styles.grab}>
          <View style={[styles.handle, { backgroundColor: c.line }]} />
          {title ? <Text variant="headline" accessibilityRole="header">{title}</Text> : null}
        </View>
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: tokens.radius.sheet, borderTopRightRadius: tokens.radius.sheet, borderWidth: tokens.size.border, paddingHorizontal: tokens.layout.gutter, gap: tokens.space.md, maxWidth: tokens.layout.largePhoneWidth * 1.5, width: "100%", alignSelf: "center" },
  grab: { paddingTop: tokens.space.xs, gap: tokens.space.sm },
  handle: { alignSelf: "center", width: tokens.size.handleWidth, height: tokens.size.handle, borderRadius: tokens.radius.full },
});
