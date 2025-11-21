import '@testing-library/jest-native/extend-expect';

// Mock global.import.meta for Expo
global.import = {
  meta: {
    url: 'file:///test',
    env: {},
  },
};

// Mock __ExpoImportMetaRegistry
global.__ExpoImportMetaRegistry = new Map();

// Mock Expo modules
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('expo-font', () => ({
  loadAsync: jest.fn(),
  isLoaded: jest.fn(() => true),
}));

jest.mock('expo-asset', () => ({
  Asset: {
    loadAsync: jest.fn(),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Supabase
jest.mock('./lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
        })),
      })),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
    auth: {
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
    },
  },
}));

// Mock environment variables (use Object.defineProperty to avoid babel issues)
Object.defineProperty(process.env, 'EXPO_PUBLIC_SUPABASE_URL', {
  value: 'https://test.supabase.co',
  writable: true
});
Object.defineProperty(process.env, 'EXPO_PUBLIC_SUPABASE_ANON_KEY', {
  value: 'test-anon-key',
  writable: true
});
Object.defineProperty(process.env, 'EXPO_PUBLIC_OPENAI_API_KEY', {
  value: 'test-openai-key',
  writable: true
});
Object.defineProperty(process.env, 'EXPO_PUBLIC_EDAMAM_APP_ID', {
  value: 'test-app-id',
  writable: true
});
Object.defineProperty(process.env, 'EXPO_PUBLIC_EDAMAM_APP_KEY', {
  value: 'test-app-key',
  writable: true
});

// Suppress console warnings during tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  warn: jest.fn(),
  error: jest.fn(),
};
