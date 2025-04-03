// constants/Colors.ts
export const Colors = {
  light: {
    text: "#000",
    background: "#fff",
    tint: "#2E7D32", // Updated to green
    tabIconDefault: "#ccc",
    tabIconSelected: "#2E7D32", // Updated to green
    icon: "#2E7D32", // Added for icon colors
  },
  dark: {
    text: "#fff",
    background: "#000",
    tint: "#4CAF50", // Updated to light green for dark mode
    tabIconDefault: "#666",
    tabIconSelected: "#4CAF50", // Updated to light green for dark mode
    icon: "#4CAF50", // Added for icon colors
  },
} as const;

export default Colors;
