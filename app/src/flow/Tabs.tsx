import { useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { fr } from "../copy/fr";
import { Gradient, Icon, Sheet, Text, haptic, tokens, useTheme, type IconName } from "../design";

export type Tab = "home" | "creations" | "ideas" | "brand";
export type CreateChoice = "reel" | "manual" | "visual" | "idea";
const LEFT: [Tab, IconName][] = [["home", "home"], ["creations", "grid"]];
const RIGHT: [Tab, IconName][] = [["ideas", "idea"], ["brand", "brand"]];
const CHOICES: [CreateChoice, IconName][] = [["reel", "spark"], ["manual", "hand"], ["visual", "image"], ["idea", "idea"]];
const WHY = { reel: fr.create.reelWhy, manual: fr.create.manualWhy, visual: fr.create.visualWhy, idea: fr.create.ideaWhy } as const;

// The frame of the four main tabs (étude de la refonte, « L'accueil et l'organisation »): Accueil,
// Créations, the round « + » in the middle, Idées, Marque. The « + » opens a sheet with everything
// that can be made, each with one line on what it does.
export function Tabs({ tab, onTab, onCreate, children }: { tab: Tab; onTab: (t: Tab) => void; onCreate: (c: CreateChoice) => void; children: ReactNode }) {
  const { c, motion, reduceMotion } = useTheme();
  const [open, setOpen] = useState(false);
  const pop = useRef(new Animated.Value(1)).current;
  const plus = () => {
    haptic("tap");
    if (!reduceMotion) Animated.sequence([
      Animated.timing(pop, { toValue: motion.pressScale, duration: motion.fast / 2, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, ...motion.spring, useNativeDriver: true }),
    ]).start();
    setOpen(true);
  };
  const item = ([k, icon]: [Tab, IconName]) => (
    <Pressable key={k} onPress={() => { if (k !== tab) haptic("tick"); onTab(k); }} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} accessibilityLabel={fr.home.tabs[k]} style={styles.tab}>
      <Icon name={icon} tone={tab === k ? "text" : "textMuted"} />
      <Text variant="caption" tone={tab === k ? "text" : "textMuted"}>{fr.home.tabs[k]}</Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={["top", "bottom"]}>
      <View style={styles.root}>{children}</View>
      <View accessibilityRole="tablist" style={[styles.tabs, { borderTopColor: c.line, backgroundColor: c.bg }]}>
        {LEFT.map(item)}
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Pressable onPress={plus} accessibilityRole="button" accessibilityLabel={fr.home.tabs.create} style={[styles.plus, { backgroundColor: c.action }]}>
            <Gradient />
            <View><Icon name="plus" tone="onAction" /></View>
          </Pressable>
        </Animated.View>
        {RIGHT.map(item)}
      </View>
      <Sheet visible={open} onClose={() => setOpen(false)} title={fr.create.title}>
        <View style={styles.choices}>
          {CHOICES.map(([k, icon]) => (
            <Pressable key={k} accessibilityRole="button" onPress={() => { haptic("tap"); setOpen(false); onCreate(k); }}
              style={({ pressed }) => [styles.choice, { backgroundColor: pressed ? c.surfaceRaised : c.surface }]}>
              <View style={[styles.choiceIcon, { backgroundColor: c.bg }]}><Icon name={icon} tone="actionStrong" /></View>
              <View style={styles.flex}>
                <Text variant="bodyStrong">{fr.create[k]}</Text>
                <Text variant="caption" tone="textMuted">{WHY[k]}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  tabs: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingTop: tokens.space.xs, borderTopWidth: tokens.size.border },
  tab: { alignItems: "center", gap: tokens.space.xxs, minWidth: tokens.size.touch * 1.5, minHeight: tokens.size.touch },
  plus: { width: tokens.size.button, height: tokens.size.button, borderRadius: tokens.radius.full, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  choices: { gap: tokens.space.xs },
  choice: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm, padding: tokens.space.sm, borderRadius: tokens.radius.card, minHeight: tokens.size.button },
  choiceIcon: { width: tokens.size.touch, height: tokens.size.touch, borderRadius: tokens.radius.full, alignItems: "center", justifyContent: "center" },
});
