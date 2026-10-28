// Ma DA only schedules local notifications (the Sunday summary, app/src/publish/notify.ts): no push.
// expo-notifications adds the push entitlement on its own, which the App Store provisioning profile
// does not carry, so the build fails; this removes it again.
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withoutPush(config) {
  return withEntitlementsPlist(config, c => {
    delete c.modResults["aps-environment"];
    return c;
  });
};
