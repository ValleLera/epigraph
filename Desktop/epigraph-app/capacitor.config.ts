import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.valeriia.epigraph',
  appName: 'Epigraph',
  webDir: 'www',
  server: {
    url: 'https://epigraph-pi.vercel.app?theme=eink',
    cleartext: false
  }
};

export default config;
