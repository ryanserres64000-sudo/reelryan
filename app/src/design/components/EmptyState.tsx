import { StyleSheet, View } from "react-native";
import { tokens } from "../tokens";
import { Text } from "../Text";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

// An empty screen is a first step, never a dead end: what will appear here, and the one button to make it.
export function EmptyState({ icon, title, detail, action, onAction }: { icon: IconName; title: string; detail?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.wrap}>
      <Icon name={icon} tone="textMuted" size={tokens.size.touch} />
      <Text variant="headline" style={styles.center}>{title}</Text>
      {detail ? <Text variant="callout" tone="textMuted" style={styles.center}>{detail}</Text> : null}
      {action && onAction ? <Button variant="secondary" label={action} onPress={onAction} style={styles.button} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: tokens.space.xs, paddingVertical: tokens.space.xl },
  center: { textAlign: "center" },
  button: { alignSelf: "center", marginTop: tokens.space.xs },
});
