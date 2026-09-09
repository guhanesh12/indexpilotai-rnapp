declare module 'react-native-otp-entry' {
  import { ViewStyle, TextStyle } from 'react-native';

  interface OtpInputTheme {
    containerStyle?: ViewStyle;
    pinCodeContainerStyle?: ViewStyle;
    pinCodeTextStyle?: TextStyle;
    focusStickStyle?: ViewStyle;
    focusedPinCodeContainerStyle?: ViewStyle;
    placeholderTextStyle?: TextStyle;
  }

  interface OtpInputProps {
    numberOfDigits: number;
    onTextChange: (text: string) => void;
    onFilled: (code: string) => void;
    autoFocus?: boolean;
    theme?: OtpInputTheme;
    focusColor?: string;
    type?: 'numeric' | 'alpha' | 'alphanumeric';
    blurOnFilled?: boolean;
    disabled?: boolean;
    placeholder?: string;
    secureTextEntry?: boolean;
    hideStick?: boolean;
    selectionColor?: string;
  }

  const OtpInput: React.FC<OtpInputProps>;
  export default OtpInput;
}
