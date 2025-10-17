// app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { useColorScheme } from "../../hooks/useColorScheme";
import { Colors } from "../../constants/Colors";
import { HapticTab } from "../../components/HapticTab";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        tabBarInactiveTintColor: Colors[colorScheme ?? "light"].tabIconDefault,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <HapticTab iconName="home" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scenarios"
        options={{
          title: "Scenarios",
          tabBarIcon: ({ color }) => (
            <HapticTab iconName="book" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <HapticTab iconName="user" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}