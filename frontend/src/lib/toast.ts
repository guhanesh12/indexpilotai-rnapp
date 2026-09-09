import { Alert } from 'react-native';

export const showToast = (message: string, duration?: 'short' | 'long') => {
  // This is a placeholder implementation. In a real app, you might use
  // a dedicated toast library (e.g., 'react-native-toast-message') or
  // a custom component for richer toast notifications.
  Alert.alert('App Message', message);
};
