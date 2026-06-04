// Expo calls this with `{ config }` (merged expo from app.json). Return `{ expo: { ...config } }` so ios/plugins stay intact.
module.exports = ({ config }) => ({
  expo: {
    ...config,
    extra: {
      ...(config.extra ?? {}),
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    },
    scheme: 'rork-app',
    name: 'Picker Pro',
    icon: './assets/images/packing_logo.png',
    splash: {
      image: './assets/images/packing_logo.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    android: {
      ...config.android,
      adaptiveIcon: {
        foregroundImage: './assets/images/packing_logo.png',
        backgroundColor: '#ffffff',
      },
      usesCleartextTraffic: true,
      package: config.android?.package || 'com.selorg.pickerapp',
      minSdkVersion: 26,
    },
  },
});
