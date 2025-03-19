// components/ui/Typography.tsx
import React, { ReactNode } from 'react';
import { Text, TextProps, StyleSheet, TextStyle } from 'react-native';
import { useTheme } from '@/lib/theme/theme';

type TypographyVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body1'
  | 'body2'
  | 'caption'
  | 'button';

export interface TypographyProps extends TextProps {
  children: ReactNode;
  variant?: TypographyVariant;
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  italic?: boolean;
}

export function Typography({
  children,
  variant = 'body1',
  color,
  align,
  weight,
  italic,
  style,
  ...rest
}: TypographyProps) {
  const theme = useTheme();

  const fontColor = color
    ? color
    : variant === 'caption'
    ? theme.colors.text.secondary
    : theme.colors.text.primary;

  const variantStyle = theme.typography[variant];

  // Explicitly cast each conditional style to TextStyle to ensure correct literal types.
  const customStyle = StyleSheet.flatten([
    variantStyle,
    { color: fontColor },
    align ? ({ textAlign: align } as TextStyle) : {},
    weight ? ({ fontWeight: theme.fontWeights[weight] } as TextStyle) : {},
    italic ? ({ fontStyle: 'italic' } as TextStyle) : {},
    style,
  ]);

  return (
    <Text style={customStyle} {...rest}>
      {children}
    </Text>
  );
}

// Convenient component exports for specific typography variants
export function DisplayText(props: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="display" {...props} />;
}

export function Heading1(props: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="h1" {...props} />;
}

export function Heading2(props: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="h2" {...props} />;
}

export function Heading3(props: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="h3" {...props} />;
}

export function Body1(props: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="body1" {...props} />;
}

export function Body2(props: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="body2" {...props} />;
}

export function Caption(props: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="caption" {...props} />;
}

export function ButtonText(props: Omit<TypographyProps, 'variant'>) {
  return <Typography variant="button" {...props} />;
}
