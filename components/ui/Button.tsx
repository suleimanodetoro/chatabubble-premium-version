import React, { ReactNode } from 'react';
import { 
  Pressable, 
  StyleSheet, 
  ViewStyle, 
  TextStyle, 
  ActivityIndicator,
  StyleProp 
} from 'react-native';
import { useTheme } from '@/lib/theme/theme';
import { ButtonText } from './Typography';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'icon';
type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  iconPosition?: 'left' | 'right';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  haptic?: 'light' | 'medium' | 'heavy' | 'selection' | 'none';
}

export function Button({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  onPress,
  style,
  textStyle,
  haptic = 'light',
}: ButtonProps) {
  const theme = useTheme();

  const handlePress = () => {
    if (disabled || loading) return;
    
    if (haptic !== 'none') {
      if (haptic === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (haptic === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (haptic === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      else if (haptic === 'selection') Haptics.selectionAsync();
    }
    
    onPress?.();
  };

  const getButtonStyles = (): ViewStyle => {
    // Base styles that apply to all buttons
    const baseStyles: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.md,
      overflow: 'hidden',
    };

    // Size specific styles
    const sizeStyles: Record<ButtonSize, ViewStyle> = {
      small: {
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        minHeight: 32,
      },
      medium: {
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        minHeight: 44,
      },
      large: {
        paddingHorizontal: theme.spacing.xl,
        paddingVertical: theme.spacing.md,
        minHeight: 56,
      },
    };

    // Variant specific styles
    const variantStyles: Record<ButtonVariant, ViewStyle> = {
      primary: {
        backgroundColor: theme.colors.primary.main,
        ...theme.shadows.md,
      },
      secondary: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.primary.main,
      },
      tertiary: {
        backgroundColor: 'transparent',
        paddingHorizontal: theme.spacing.sm,
      },
      icon: {
        backgroundColor: 'transparent',
        width: size === 'small' ? 32 : size === 'medium' ? 44 : 56,
        height: size === 'small' ? 32 : size === 'medium' ? 44 : 56,
        borderRadius: theme.radius.full,
        padding: 0,
      },
    };

    // State styles
    const stateStyles: ViewStyle = {
      ...(disabled && {
        opacity: 0.5,
      }),
      ...(fullWidth && {
        width: '100%',
      }),
    };

    return {
      ...baseStyles,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...stateStyles,
    };
  };

  const getTextColor = (): string => {
    if (variant === 'primary') {
      return theme.colors.primary.contrast;
    } else if (variant === 'secondary' || variant === 'tertiary' || variant === 'icon') {
      return theme.colors.primary.main;
    }
    return theme.colors.text.primary;
  };

  const buttonStyles = getButtonStyles();
  const textColor = getTextColor();

  const renderIcon = () => {
    if (!icon) return null;
    
    const iconSize = size === 'small' ? 16 : size === 'medium' ? 20 : 24;
    
    return (
      <Feather 
        name={icon} 
        size={iconSize} 
        color={textColor} 
        style={iconPosition === 'left' ? styles.iconLeft : styles.iconRight} 
      />
    );
  };

  return (
    <Pressable
      style={({ pressed }) => [
        buttonStyles, 
        pressed && styles.pressed,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator 
          size={size === 'small' ? 'small' : 'small'} 
          color={textColor} 
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && renderIcon()}
          {children && (
            <ButtonText 
              color={textColor}
              style={[
                size === 'small' && { fontSize: theme.fontSizes.sm },
                textStyle,
              ]}
            >
              {children}
            </ButtonText>
          )}
          {icon && (iconPosition === 'right' || variant === 'icon') && renderIcon()}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.8,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
