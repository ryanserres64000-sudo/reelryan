import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Hero } from "../brand/Hero";
import { checkEmailCode, methods, sendEmailCode, signInApple, signInGoogle, type Methode, type Methodes, type Result, type Session } from "../auth/session";
import { fr } from "../copy/fr";
import { Button, Icon, MadaSays, Screen, Sheet, Text, haptic, tokens, typeStyle, useTheme } from "../design";
import { LEGAL } from "../legal";

const t = fr.dna.welcome;
// « Se connecter avec Apple » needs the capability on the App ID; the build says when it is there.
const APPLE_NATIVE = Platform.OS === "ios" && process.env.EXPO_PUBLIC_APPLE_SIGNIN === "1";

// Onboarding 1 (Ryan, 28 et 29 octobre : l'inscription au début, avec Google, Apple ou un e-mail, et une
// première page qui donne envie). A Reel making itself, the promise in two lines, then the three ways
// in. A way the server does not offer yet says so when touched instead of failing.
export function WelcomeScreen({ onSignedIn, onWithout }: { onSignedIn: (s: Session) => void; onWithout: () => void }) {
  const [offered, setOffered] = useState<Methodes | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<Methode | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [waysOpen, setWaysOpen] = useState(false);
  const { motion } = useTheme();
  useEffect(() => { methods().then(setOffered); }, []);
  const none = offered && !offered.apple && !offered.google && !offered.email;

  const done = (r: Result<Session>) => {
    setBusy(null);
    if (r.ok) { haptic("success"); onSignedIn(r.value); return; }
    setNote(r.error === "config" ? null : t.errors[r.error === "refus" || r.error === "reseau" || r.error === "lien" ? r.error : "autre"]);
  };
  const start = async (m: Methode) => {
    setNote(null);
    if (!offered?.[m] || (m === "apple" && !APPLE_NATIVE)) { setNote(t.unavailable[m]); return; }
    if (m === "email") { setEmailOpen(true); return; }
    setBusy(m);
    if (m === "google") return done(await signInGoogle());
    try {
      const cred = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL] });
      if (!cred.identityToken) return done({ ok: false, error: "autre" });
      done(await signInApple(cred.identityToken, cred.fullName?.givenName ?? null));
    } catch (e: any) { done({ ok: false, error: e?.code === "ERR_REQUEST_CANCELED" ? "refus" : "autre" }); }
  };

  const pick = (m: Methode) => {
    // The e-mail has its own sheet: this one closes first, then it rises.
    if (m === "email" && offered?.email) { setWaysOpen(false); setTimeout(() => setEmailOpen(true), motion.base); return; }
    start(m);
  };
  return (
    <Screen
      footer={<Pull onOpen={() => setWaysOpen(true)} />}>
      <Text variant="mono" tone="actionStrong">{t.kicker}</Text>
      <Hero />
      <View style={styles.copy}>
        <Text variant="display" accessibilityRole="header">{t.title}</Text>
        <Text tone="textMuted">{t.detail}</Text>
      </View>
      <Sheet visible={waysOpen} onClose={() => setWaysOpen(false)} title={t.waysTitle}>
        {note ? <MadaSays text={note} /> : null}
        {APPLE_NATIVE && offered?.apple ? (
          <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} cornerRadius={tokens.radius.full} style={styles.apple} onPress={() => pick("apple")} />
        ) : <Way label={busy === "apple" ? t.waiting : t.apple} filled onPress={() => pick("apple")} mark={<Icon name="apple" tone="bg" />} />}
        <Way label={busy === "google" ? t.waiting : t.google} onPress={() => pick("google")} mark={<GoogleMark />} />
        <Way label={t.email} onPress={() => pick("email")} mark={<Icon name="mail" />} />
        {none ? <Button variant="secondary" label={t.without} onPress={() => { setWaysOpen(false); onWithout(); }} /> : null}
        <Text variant="caption" tone="textMuted" style={styles.center}>{t.legal}</Text>
        <View style={styles.links}>
          {LEGAL.terms ? <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(LEGAL.terms!)} hitSlop={tokens.space.xs}><Text variant="caption" tone="actionStrong">{t.terms}</Text></Pressable> : null}
          {LEGAL.privacy ? <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(LEGAL.privacy!)} hitSlop={tokens.space.xs}><Text variant="caption" tone="actionStrong">{t.privacyLink}</Text></Pressable> : null}
        </View>
      </Sheet>
      <EmailSheet visible={emailOpen} onClose={() => setEmailOpen(false)} onSignedIn={s => { setEmailOpen(false); onSignedIn(s); }} />
    </Screen>
  );
}

// The way in, kept small at the bottom (Ryan, 29 octobre : « se connecter ou créer un compte en petit,
// glisser vers le haut ») so the first page stays clean. A swipe up or a tap opens the choices.
function Pull({ onOpen }: { onOpen: () => void }) {
  const { c, motion, reduceMotion } = useTheme();
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: -tokens.space.xxs, duration: motion.slow, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: motion.slow, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduceMotion]);
  const open = useRef(onOpen); open.current = onOpen;
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, d) => d.dy < -tokens.space.xs,
    onPanResponderMove: (_, d) => { if (d.dy < -tokens.space.lg) { haptic("tick"); open.current(); } },
  }), []);
  return (
    <Pressable {...pan.panHandlers} accessibilityRole="button" accessibilityLabel={t.pull} accessibilityHint={t.pullHint} onPress={onOpen} style={styles.pull}>
      <Animated.View style={[styles.pullInner, { transform: [{ translateY: bob }] }]}>
        <View style={[styles.grip, { backgroundColor: c.line }]} />
        <Text variant="bodyStrong">{t.pull}</Text>
        <Text variant="caption" tone="textMuted">{t.pullHint}</Text>
      </Animated.View>
    </Pressable>
  );
}

function Way({ label, mark, filled, onPress }: { label: string; mark: React.ReactNode; filled?: boolean; onPress: () => void }) {
  const { c, opacity } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.way, filled ? { backgroundColor: c.text } : { borderColor: c.line, borderWidth: tokens.size.border }, { opacity: pressed ? opacity.pressed : 1 }]}>
      {mark}
      <Text variant="button" tone={filled ? "bg" : "text"}>{label}</Text>
    </Pressable>
  );
}

// Google's « G », in its own colours (its brand guidelines ask for them unchanged).
function GoogleMark() {
  const [blue, green, yellow, red] = tokens.marques.google;
  return (
    <Svg width={tokens.size.icon} height={tokens.size.icon} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path fill={red} d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill={blue} d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill={yellow} d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill={green} d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

// E-mail: the address, then the 6-digit code (iOS offers it from Mail above the keyboard).
function EmailSheet({ visible, onClose, onSignedIn }: { visible: boolean; onClose: () => void; onSignedIn: (s: Session) => void }) {
  const { c } = useTheme();
  const e = t.emailSheet;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const input = [typeStyle("body"), styles.input, { color: c.text, borderColor: c.line, backgroundColor: c.surface }];
  const send = async () => {
    setBusy(true); setNote(null);
    const r = await sendEmailCode(email.trim());
    setBusy(false);
    if (r.ok) { setSent(true); setCode(""); if (r.value.dev) setNote(e.dev(r.value.dev)); }
    else setNote(r.error === "email" ? e.invalid : r.message ?? t.errors[r.error === "reseau" ? "reseau" : "autre"]);
  };
  const verify = async (v = code) => {
    setBusy(true); setNote(null);
    const r = await checkEmailCode(email.trim(), v);
    setBusy(false);
    if (r.ok) { haptic("success"); onSignedIn(r.value); }
    else setNote(r.error === "code" ? r.message ?? e.wrong : t.errors[r.error === "reseau" ? "reseau" : "autre"]);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={sent ? e.codeTitle : e.title}>
      <Text tone="textMuted">{sent ? e.codeDetail(email.trim()) : e.detail}</Text>
      {!sent ? (
        <TextInput value={email} onChangeText={setEmail} placeholder={e.placeholder} placeholderTextColor={c.textMuted} accessibilityLabel={e.title}
          keyboardType="email-address" textContentType="emailAddress" autoComplete="email" autoCapitalize="none" autoCorrect={false} autoFocus
          returnKeyType="send" onSubmitEditing={send} style={input} />
      ) : (
        <TextInput value={code} onChangeText={v => { const d = v.replace(/\D/g, "").slice(0, 6); setCode(d); if (d.length === 6) verify(d); }}
          placeholder="000000" placeholderTextColor={c.textMuted} accessibilityLabel={e.codeLabel} keyboardType="number-pad"
          textContentType="oneTimeCode" autoComplete="one-time-code" autoFocus maxLength={6} style={[input, styles.code]} />
      )}
      {note ? <MadaSays text={note} /> : null}
      {!sent
        ? <Button label={e.send} disabled={busy || !email.includes("@")} onPress={send} />
        : <>
          <Button label={e.verify} disabled={busy || code.length !== 6} onPress={() => verify()} />
          <View style={styles.links}>
            <Pressable accessibilityRole="button" onPress={send} hitSlop={tokens.space.xs}><Text variant="callout" tone="actionStrong">{e.resend}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setSent(false); setNote(null); }} hitSlop={tokens.space.xs}><Text variant="callout" tone="actionStrong">{e.change}</Text></Pressable>
          </View>
        </>}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  copy: { gap: tokens.space.xs },
  pull: { alignItems: "center", minHeight: tokens.size.button },
  pullInner: { alignItems: "center", gap: tokens.space.xxs },
  grip: { width: tokens.size.button, height: tokens.size.textBar, borderRadius: tokens.radius.full, marginBottom: tokens.space.xxs },
  way: { minHeight: tokens.size.button, borderRadius: tokens.radius.full, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: tokens.space.xs, paddingHorizontal: tokens.space.lg },
  apple: { height: tokens.size.button, alignSelf: "stretch" },
  center: { textAlign: "center" },
  links: { flexDirection: "row", justifyContent: "center", gap: tokens.space.lg },
  input: { minHeight: tokens.size.button, borderWidth: tokens.size.border, borderRadius: tokens.radius.button, paddingHorizontal: tokens.space.sm },
  code: { letterSpacing: tokens.space.xs, textAlign: "center" },
});
