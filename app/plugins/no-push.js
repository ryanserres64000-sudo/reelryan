// Ma DA only schedules local notifications (the Sunday summary, app/src/publish/notify.ts): no push.
// expo-notifications adds the push entitlement on its own, which the App Store provisioning profile
// does not carry, so the build fails; this removes it again.
// Same for « Se connecter avec Apple » (expo-apple-authentication, build 6 failed on it): kept only once
// the capability is on for com.madastudio.app and the profile renewed, which the GitHub variable
// MADA_APPLE_SIGNIN=1 says (.github/workflows/ios.yml → EXPO_PUBLIC_APPLE_SIGNIN).
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withoutPush(config) {
  return withEntitlementsPlist(config, c => {
    delete c.modResults["aps-environment"];
    if (process.env.EXPO_PUBLIC_APPLE_SIGNIN !== "1") delete c.modResults["com.apple.developer.applesignin"];
    return c;
  });
};
