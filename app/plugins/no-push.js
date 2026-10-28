// Ma DA only schedules local notifications (the Sunday summary, app/src/publish/notify.ts): no push.
// expo-notifications adds the push entitlement on its own, which the App Store provisioning profile
// does not carry, so the build fails; this removes it again.
// Same for « Se connecter avec Apple » (expo-apple-authentication, build 6 failed on it): removed until
// the comptes stage turns the capability on for com.madastudio.app and renews the profile.
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withoutPush(config) {
  return withEntitlementsPlist(config, c => {
    delete c.modResults["aps-environment"];
    delete c.modResults["com.apple.developer.applesignin"];
    return c;
  });
};
