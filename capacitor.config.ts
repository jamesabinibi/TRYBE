import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gryndee.app',
  appName: 'Gryndee',
  webDir: 'dist',
  server: {
    cleartext: true,
    allowNavigation: ['*']
  }
};

export default config;
