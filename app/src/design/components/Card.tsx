import { StyleSheet, View, type ViewProps } from "react-native";
import { tokens } from "../tokens";
import { useTheme } from "../theme";

export function Card({ style, raised = false, ...rest }: ViewProps & { raised?: boolean }) {
  const { c } = useTheme();
  return <View style={[styles.base, { backgroundColor: raised ? c.surfaceRaised : c.surface, borderColor: c.line }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: { borderRadius: tokens.radius.card, borderWidth: tokens.size.border, padding: tokens.space.md, gap: tokens.space.sm },
});
