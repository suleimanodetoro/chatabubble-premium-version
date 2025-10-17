// components/ui/Card.tsx
import React, { ReactNode } from 'react';
import { 
  View, 
  StyleSheet, 
  Pressable, 
  StyleProp, 
  ViewStyle,
  LayoutAnimation,
  Platform,
  UIManager 
} from 'react-native';
import { useTheme } from '@/lib/theme/theme';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

type CardVariant = 'elevated' | 'flat' | 'outlined';

export interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Card({
  children,
  variant = 'elevated',
  onPress,
  style,
  contentStyle,
  testID,
}: CardProps) {
  const theme = useTheme();
  
  const handlePress = () => {
    if (onPress) {
      // Simple fade animation on press
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      onPress();
    }
  };

  const getCardStyles = (): ViewStyle => {
    const baseStyles: ViewStyle = {
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
    };

    const variantStyles: Record<CardVariant, ViewStyle> = {
      elevated: {
        backgroundColor: theme.colors.background.paper,
        ...theme.shadows.md,
      },
      flat: {
        backgroundColor: theme.colors.background.default,
      },
      outlined: {
        backgroundColor: theme.colors.background.paper,
        borderWidth: 1,
        borderColor: theme.colors.divider,
      },
    };

    return {
      ...baseStyles,
      ...variantStyles[variant],
    };
  };

  const cardStyles = getCardStyles();

  const CardComponent = onPress ? Pressable : View;
  const pressableProps = onPress ? {
    onPress: handlePress,
    android_ripple: { color: theme.colors.primary.light, borderless: false },
  } : {};

  return (
    <CardComponent
      style={({pressed}) => [
        cardStyles,
        onPress && pressed && styles.pressed,
        style,
      ]}
      testID={testID}
      {...pressableProps}
    >
      <View style={[styles.content, contentStyle]}>
        {children}
      </View>
    </CardComponent>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function CardHeader({ title, subtitle, action, style }: CardHeaderProps) {
  const theme = useTheme();
  
  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerContent}>
        {typeof title === 'string' ? (
          <View style={styles.titleContainer}>
            <Heading3>{title}</Heading3>
            {subtitle && (
              <Body2 color={theme.colors.text.secondary}>{subtitle}</Body2>
            )}
          </View>
        ) : (
          title
        )}
      </View>
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

export interface CardContentProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function CardContent({ children, style }: CardContentProps) {
  return <View style={[styles.cardContent, style]}>{children}</View>;
}

export interface CardFooterProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function CardFooter({ children, style }: CardFooterProps) {
  const theme = useTheme();
  
  return (
    <View style={[
      styles.footer,
      { borderTopColor: theme.colors.divider },
      style,
    ]}>
      {children}
    </View>
  );
}

// Import these here to avoid circular dependencies
import { Heading3, Body2 } from './Typography';

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.9,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerContent: {
    flex: 1,
  },
  titleContainer: {
    flex: 1,
  },
  action: {
    marginLeft: 8,
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});