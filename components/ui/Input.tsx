// components/ui/Input.tsx
import React, { useState, useRef, forwardRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TextInputProps,
  Pressable,
  Animated,
  StyleProp,
  ViewStyle,
  TextStyle,
  LayoutAnimation,
  Platform,
} from 'react-native';
import { useTheme } from '@/lib/theme/theme';
import { Feather } from '@expo/vector-icons';
import { Body2, Caption } from './Typography';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputContainerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  errorStyle?: StyleProp<TextStyle>;
  hintStyle?: StyleProp<TextStyle>;
  iconName?: keyof typeof Feather.glyphMap;
  clearable?: boolean;
  onClear?: () => void;
}

export const Input = forwardRef<TextInput, InputProps>(({
  label,
  error,
  hint,
  prefix,
  suffix,
  containerStyle,
  inputContainerStyle,
  inputStyle,
  labelStyle,
  errorStyle,
  hintStyle,
  iconName,
  clearable = false,
  onClear,
  onFocus,
  onBlur,
  value,
  style,
  ...rest
}, ref) => {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showClearButton, setShowClearButton] = useState(!!value);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = (e: any) => {
    setIsFocused(true);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onBlur?.(e);
  };

  const handleChangeText = (text: string) => {
    rest.onChangeText?.(text);
    setShowClearButton(!!text);
  };

  const handleClear = () => {
    rest.onChangeText?.('');
    onClear?.();
    setShowClearButton(false);
  };

  const borderColor = error 
    ? theme.colors.error.main
    : isFocused 
      ? theme.colors.primary.main 
      : theme.colors.divider;

  const activeColor = error
    ? theme.colors.error.main
    : theme.colors.primary.main;

  const textColor = error
    ? theme.colors.error.main
    : theme.colors.text.primary;

  const labelTop = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });
  
  const labelScale = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.85],
  });

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Animated.Text
          style={[
            styles.label,
            {
              color: isFocused ? activeColor : theme.colors.text.secondary,
              transform: [{ translateY: labelTop }, { scale: labelScale }],
            },
            labelStyle,
          ]}
        >
          {label}
        </Animated.Text>
      )}

      <View
        style={[
          styles.inputContainer,
          {
            borderColor,
            backgroundColor: rest.editable === false 
              ? theme.colors.background.default 
              : theme.colors.background.paper,
          },
          inputContainerStyle,
        ]}
      >
        {iconName && (
          <Feather
            name={iconName}
            size={18}
            color={isFocused ? activeColor : theme.colors.text.secondary}
            style={styles.icon}
          />
        )}

        {prefix && <View style={styles.adornment}>{prefix}</View>}

        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              color: textColor,
            },
            inputStyle,
            style,
          ]}
          placeholderTextColor={theme.colors.text.hint}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChangeText={handleChangeText}
          value={value}
          {...rest}
        />

        {clearable && showClearButton && (
          <Pressable onPress={handleClear} style={styles.clearButton}>
            <Feather
              name="x-circle"
              size={16}
              color={theme.colors.text.secondary}
            />
          </Pressable>
        )}

        {suffix && <View style={styles.adornment}>{suffix}</View>}
      </View>

      {error ? (
        <Caption
          color={theme.colors.error.main}
          style={[styles.helper, errorStyle]}
        >
          {error}
        </Caption>
      ) : hint ? (
        <Caption
          color={theme.colors.text.hint}
          style={[styles.helper, hintStyle]}
        >
          {hint}
        </Caption>
      ) : null}
    </View>
  );
});

export interface SearchInputProps extends Omit<InputProps, 'iconName'> {
  onSearch?: (query: string) => void;
  onClearSearch?: () => void;
}

export function SearchInput({
  onSearch,
  onClearSearch,
  placeholder = 'Search...',
  ...props
}: SearchInputProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const handleChangeText = (text: string) => {
    setQuery(text);
    props.onChangeText?.(text);
  };

  const handleSearch = () => {
    onSearch?.(query);
  };

  const handleClear = () => {
    setQuery('');
    onClearSearch?.();
  };

  return (
    <Input
      iconName="search"
      placeholder={placeholder}
      returnKeyType="search"
      clearable
      value={query}
      onChangeText={handleChangeText}
      onClear={handleClear}
      onSubmitEditing={handleSearch}
      inputContainerStyle={styles.searchContainer}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    position: 'absolute',
    left: 0,
    top: -6,
    zIndex: 1,
    paddingHorizontal: 4,
    backgroundColor: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    marginVertical: 0,
  },
  icon: {
    marginRight: 8,
  },
  adornment: {
    marginHorizontal: 4,
  },
  clearButton: {
    padding: 4,
  },
  helper: {
    marginTop: 4,
    marginLeft: 4,
  },
  searchContainer: {
    borderRadius: 24,
  },
});