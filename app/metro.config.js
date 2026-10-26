// The app imports the shared logic of ../core (timeline v1), outside the Expo project.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, "../core")];
module.exports = config;
