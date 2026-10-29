import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fr } from "../../copy/fr";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { useTheme } from "../theme";

type Props = { title?: string; detail?: string; onBack?: () => void; footer?: ReactNode; children: ReactNode; scroll?: boolean; scrollEnabled?: boolean };

// Frame of every step: back link, title, scrolling content, and the one gold button at the bottom (étude, ch. 6 §4).
export function Screen({ title, detail, onBack, footer, children, scroll = true, scrollEnabled = true }: Props) {
  const { c, layout, opacity } = useTheme();
  const { width } = useWindowDimensions();
  const gutter = width >= layout.largePhoneWidth ? layout.gutterLarge : layout.gutter;
  const head = !onBack && !title && !detail ? null : (
    <View style={styles.head}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={tokens.space.xs} style={({ pressed }) => [styles.back, { opacity: pressed ? opacity.pressed : 1 }]}>
          <Text variant="callout" tone="textMuted">{`‹ ${fr.nav.back}`}</Text>
        </Pressable>
      ) : null}
      {title ? <Text variant="title" accessibilityRole="header">{title}</Text> : null}
      {detail ? <Text tone="textMuted">{detail}</Text> : null}
    </View>
  );
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top", "bottom"]}>
      {scroll ? (
        <ScrollView scrollEnabled={scrollEnabled} contentContainerStyle={[styles.content, { paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled">{head}{children}</ScrollView>
      ) : (
        <View style={[styles.root, styles.content, { paddingHorizontal: gutter }]}>{head}{children}</View>
      )}
      {footer ? <View style={[styles.footer, { paddingHorizontal: gutter, borderTopColor: c.line, backgroundColor: c.bg }]}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: tokens.space.lg, paddingVertical: tokens.space.md, maxWidth: tokens.layout.largePhoneWidth * 1.5, width: "100%", alignSelf: "center" },
  head: { gap: tokens.space.xs },
  back: { alignSelf: "flex-start", minHeight: tokens.size.touch, justifyContent: "center" },
  footer: { gap: tokens.space.xs, paddingVertical: tokens.space.sm, borderTopWidth: tokens.size.border },
});
