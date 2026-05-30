const { withInfoPlist, createRunOncePlugin } = require('@expo/config-plugins');

/**
 * Keep JS-driven status bar control working:
 * RCTStatusBarManager requires UIViewControllerBasedStatusBarAppearance = NO.
 */
module.exports = createRunOncePlugin(
  (config) =>
    withInfoPlist(config, (config) => {
      config.modResults.UIViewControllerBasedStatusBarAppearance = false;
      return config;
    }),
  'with-ios-uiviewcontroller-based-status-bar'
);
