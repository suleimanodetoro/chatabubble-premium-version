import { View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColor } from '@/hooks/useThemeColor';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  useSafeArea?: boolean; // New prop to enable SafeAreaView functionality
};

export function ThemedView({ style, lightColor, darkColor, useSafeArea, ...otherProps }: ThemedViewProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  const Wrapper = useSafeArea ? SafeAreaView : View;

  return <Wrapper style={[{ backgroundColor }, style]} {...otherProps} />;
}
