export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    androidScheme?: string;
    url?: string;
    cleartext?: boolean;
  };
  android?: {
    backgroundColor?: string;
  };
}

const config: CapacitorConfig = {
  appId: 'com.fatyliser.eq',
  appName: 'Fatyliser',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    backgroundColor: '#0a0d14'
  }
};

export default config;
