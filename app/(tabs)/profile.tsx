// app/(tabs)/profile.tsx
import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  View,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useAppStore } from "@/hooks/useAppStore";
import { MetricsService } from "@/lib/services/metrics";
import { supabase } from "@/lib/supabase/client";
import { EncryptionService } from "@/lib/services/encryption";
import { AuthService } from "@/lib/services/auth";
import { useTheme } from "@/lib/theme/theme";
import { Heading1, Heading2, Heading3, Body1, Body2, Caption } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Feather } from '@expo/vector-icons';
import Animated, { 
  FadeInDown, 
  Layout, 
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring 
} from "react-native-reanimated";

// Custom components for the profile screen
const ProfileHeader = ({ 
  user, 
  lastActive, 
  onEditProfile 
}: { 
  user: any; 
  lastActive?: string; 
  onEditProfile: () => void;
}) => {
  const theme = useTheme();
  const avatarRotation = useSharedValue(0);
  
  const avatarStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateY: `${avatarRotation.value}deg` }]
    };
  });
  
  const handlePressAvatar = () => {
    avatarRotation.value = withSpring(avatarRotation.value + 360, {
      damping: 20,
      stiffness: 90
    });
  };
  
  // Generate initials from name or email
  const getInitials = () => {
    if (user?.name) {
      return user.name.split(' ')
        .map((part: string) => part.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2);
    }
    
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    
    return 'U';
  };
  
  return (
    <Card variant="flat" style={styles.profileHeaderCard}>
      <CardContent style={styles.profileHeaderContent}>
        <TouchableOpacity onPress={handlePressAvatar}>
          <Animated.View style={[styles.avatarContainer, avatarStyle, { backgroundColor: theme.colors.primary.main }]}>
            <Heading1 color="#fff">{getInitials()}</Heading1>
          </Animated.View>
        </TouchableOpacity>
        
        <View style={styles.profileInfo}>
          <Heading2>{user?.name || 'User'}</Heading2>
          <Body1 color={theme.colors.text.secondary}>{user?.email}</Body1>
          
          {lastActive && (
            <Caption style={styles.lastActiveText}>
              Last active: {new Date(lastActive).toLocaleDateString()}
            </Caption>
          )}
        </View>
        
        <Button
          variant="tertiary"
          icon="edit-2"
          size="small"
          onPress={onEditProfile}
        />
      </CardContent>
    </Card>
  );
};

const ProgressCard = ({ metrics, isLoading }: { metrics: any; isLoading: boolean }) => {
    const theme = useTheme();
    const rotation = useSharedValue(0);
    const language = Object.keys(metrics?.languageProgress || {})[0];
    const languageData = language ? metrics?.languageProgress[language] : null;
    
    const progressBarWidth = useSharedValue(0);
    
    // Set progress bar animation
    useEffect(() => {
      if (!isLoading && languageData) {
        const sessionsCompleted = languageData.sessionsCompleted || 0;
        const progress = Math.min(sessionsCompleted / 20, 1); // 20 sessions = 100%
        
        progressBarWidth.value = withSpring(progress, {
          damping: 20,
          stiffness: 90
        });
      }
    }, [isLoading, languageData]);
    
    const progressStyle = useAnimatedStyle(() => {
      return {
        width: `${progressBarWidth.value * 100}%`
      };
    });
    
    const rotatableStyle = useAnimatedStyle(() => {
      return {
        transform: [{ rotate: `${rotation.value}deg` }]
      };
    });
    
    const handleRotate = () => {
      rotation.value = withSpring(rotation.value + 360, {
        damping: 15,
        stiffness: 60
      });
    };
    
    // Fix: Ensure we're using string values for Caption content, not objects
    const getLevelString = (levelData: any): string => {
      if (!levelData) return 'beginner';
      // If levelData is already a string, return it
      if (typeof levelData === 'string') return levelData;
      // If it's an object with a name property, return that
      if (typeof levelData === 'object' && levelData.name) return levelData.name;
      // Default fallback
      return 'beginner';
    };
  
    return (
      <Card variant="elevated" style={styles.progressCard}>
        <CardHeader
          title="Your Progress"
          action={
            <TouchableOpacity onPress={handleRotate} style={styles.refreshButton}>
              <Animated.View style={rotatableStyle}>
                <Feather name="refresh-cw" size={18} color={theme.colors.primary.main} />
              </Animated.View>
            </TouchableOpacity>
          }
        />
        <CardContent>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Heading2 color={theme.colors.primary.main}>
                {isLoading ? "--" : metrics?.totalSessions || 0}
              </Heading2>
              <Caption>Total Sessions</Caption>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              <Heading2 color={theme.colors.primary.main}>
                {isLoading ? "--" : Math.round(metrics?.totalMinutesPracticed || 0)}
              </Heading2>
              <Caption>Minutes</Caption>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statItem}>
              {/* Removed streak UI */}
              <Heading2 color={theme.colors.primary.main}>
                {isLoading ? "--" : Object.keys(metrics?.languageProgress || {}).length}
              </Heading2>
              <Caption>Languages</Caption>
            </View>
          </View>
          
          {language && (
            <View style={styles.languageProgressContainer}>
              <View style={styles.languageProgressHeader}>
                <Body1 weight="semibold">{language}</Body1>
                {/* Fix: Ensure we never pass an object to Caption */}
                <Caption>{getLevelString(languageData?.level)}</Caption>
              </View>
              
              <View style={styles.progressBarContainer}>
                <Animated.View 
                  style={[
                    styles.progressBar,
                    { backgroundColor: theme.colors.primary.main },
                    progressStyle
                  ]} 
                />
              </View>
              
              <View style={styles.progressStats}>
                <Caption>{languageData?.sessionsCompleted || 0} sessions</Caption>
                <Caption>{Math.round((languageData?.totalDuration || 0) / 60000)} minutes</Caption>
              </View>
            </View>
          )}
        </CardContent>
      </Card>
    );
  };

const SettingsRow = ({ 
  icon, 
  title, 
  description, 
  onPress,
  rightIcon = "chevron-right",
}: { 
  icon: string; 
  title: string; 
  description?: string; 
  onPress: () => void;
  rightIcon?: string;
}) => {
  const theme = useTheme();
  
  return (
    <TouchableOpacity 
      style={styles.settingsRow}
      onPress={onPress}
    >
      <View style={[
        styles.settingsIcon,
        { backgroundColor: theme.colors.background.default }
      ]}>
        <Feather name={icon as any} size={20} color={theme.colors.primary.main} />
      </View>
      
      <View style={styles.settingsContent}>
        <Body1>{title}</Body1>
        {description && (
          <Body2 color={theme.colors.text.secondary}>{description}</Body2>
        )}
      </View>
      
      <Feather name={rightIcon as any} size={20} color={theme.colors.text.secondary} />
    </TouchableOpacity>
  );
};

interface DangerActionProps {
  icon: string;
  title: string;
  description?: string;
  destructive?: boolean;
  onPress: () => void;
}

const DangerAction = ({ 
  icon, 
  title, 
  description, 
  destructive = false,
  onPress 
}: DangerActionProps) => {
  const theme = useTheme();
  
  return (
    <TouchableOpacity 
      style={styles.dangerRow}
      onPress={onPress}
    >
      <View style={[
        styles.settingsIcon,
        { 
          backgroundColor: destructive 
            ? theme.colors.error.light 
            : theme.colors.background.default 
        }
      ]}>
        <Feather 
          name={icon as any} 
          size={20} 
          color={destructive ? theme.colors.error.main : theme.colors.primary.main} 
        />
      </View>
      
      <View style={styles.settingsContent}>
        <Body1 color={destructive ? theme.colors.error.main : theme.colors.text.primary}>
          {title}
        </Body1>
        {description && (
          <Body2 color={theme.colors.text.secondary}>{description}</Body2>
        )}
      </View>
    </TouchableOpacity>
  );
};

// Main Profile Screen Component
export default function ProfileScreen() {
  const router = useRouter();
  const { user, setUser, setCurrentSession, setCurrentScenario } = useAppStore();
  const theme = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  
  // Modal states
  const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isConfirmDeleteModalVisible, setIsConfirmDeleteModalVisible] = useState(false);
  
  // Form states
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileName, setProfileName] = useState(user?.name || "");

  // Load metrics on mount and when user changes
  useEffect(() => {
    loadUserMetrics();
  }, [user?.id]);

  const loadUserMetrics = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const userMetrics = await MetricsService.getUserMetrics(user.id);
      setMetrics(userMetrics);
    } catch (error) {
      console.error("Error loading metrics:", error);
      Alert.alert("Error", "Failed to load user statistics");
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserMetrics();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    try {
      // Remove encryption key before signing out
      if (user?.id) {
        await EncryptionService.removeEncryptionKey(user.id);
      }

      await supabase.auth.signOut();
      setUser(null);
      setCurrentSession(null);
      setCurrentScenario(null);
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Signout error:", error);
      Alert.alert("Error signing out", (error as Error).message);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) {
      Alert.alert("Error", "Please enter a new email");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });

      if (error) throw error;

      Alert.alert("Success", "Please check your new email for verification", [
        { text: "OK", onPress: () => setIsEmailModalVisible(false) },
      ]);
      setNewEmail("");
    } catch (error) {
      Alert.alert("Error", (error as Error).message);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      if (!user?.id) {
        throw new Error("User not found");
      }

      // Update password with Supabase
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Re-encrypt messages with new password
      await EncryptionService.handlePasswordChange(
        user.id,
        confirmPassword,
        newPassword
      );

      Alert.alert("Success", "Password updated successfully", [
        { text: "OK", onPress: () => setIsPasswordModalVisible(false) },
      ]);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Password update error:", error);
      Alert.alert("Error", "Failed to update password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user?.id) return;
    
    try {
      // Update profile in Supabase
      const { error } = await supabase
        .from('profiles')
        .update({
          username: profileName,
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      // Update local user state
      setUser({
        ...user,
        name: profileName,
      });
      
      Alert.alert("Success", "Profile updated successfully", [
        { text: "OK", onPress: () => setIsProfileModalVisible(false) },
      ]);
    } catch (error) {
      console.error("Profile update error:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    }
  };

  // Process account deletion after confirmation
  const processAccountDeletion = async () => {
    if (deleteConfirmation !== "DELETE") {
      Alert.alert("Error", "Please type DELETE to confirm account deletion");
      return;
    }

    if (!user?.id || !user?.email) {
      Alert.alert("Error", "User information is missing");
      return;
    }

    try {
      setIsDeletingAccount(true);
      setIsConfirmDeleteModalVisible(false);

      // Call enhanced AuthService delete account method
      const { success, error } = await AuthService.deleteAccount(
        user.id,
        user.email
      );

      if (!success) {
        throw new Error(error || "Failed to delete account");
      }

      // Reset app state
      setUser(null);
      setCurrentSession(null);
      setCurrentScenario(null);

      // Show success message and redirect to login
      Alert.alert(
        "Account Deleted",
        "Your account and all associated data have been deleted successfully.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(auth)/login"),
          },
        ]
      );
    } catch (error) {
      console.error("Account deletion error:", error);
      Alert.alert(
        "Error Deleting Account",
        (error as Error).message || "Please try again or contact support."
      );
    } finally {
      setIsDeletingAccount(false);
      setDeleteConfirmation("");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Heading1>Profile</Heading1>
      </View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary.main]}
            tintColor={theme.colors.primary.main}
          />
        }
      >
        <Animated.View 
          entering={FadeInDown.delay(100).springify()}
          layout={Layout.springify()}
        >
          <ProfileHeader 
            user={user} 
            lastActive={metrics?.lastPracticed}
            onEditProfile={() => {
              setProfileName(user?.name || "");
              setIsProfileModalVisible(true);
            }}
          />
        </Animated.View>
        
        <Animated.View 
          entering={FadeInDown.delay(200).springify()}
          layout={Layout.springify()}
        >
          <ProgressCard 
            metrics={metrics}
            isLoading={isLoading}
          />
        </Animated.View>
        
        <Animated.View 
          entering={FadeInDown.delay(300).springify()}
          layout={Layout.springify()}
        >
          <View style={styles.settingsSection}>
            <Heading3 style={styles.sectionTitle}>Account Settings</Heading3>
            
            <Card variant="elevated" style={styles.settingsCard}>
              <CardContent style={styles.settingsCardContent}>
                <SettingsRow
                  icon="mail"
                  title="Email Address"
                  description={user?.email}
                  onPress={() => setIsEmailModalVisible(true)}
                />
                
                <SettingsRow
                  icon="lock"
                  title="Password"
                  description="Change your password"
                  onPress={() => setIsPasswordModalVisible(true)}
                />
              </CardContent>
            </Card>
          </View>
        </Animated.View>
        
        <Animated.View 
          entering={FadeInDown.delay(400).springify()}
          layout={Layout.springify()}
        >
          <View style={styles.dangerSection}>
            <Heading3 style={styles.sectionTitle}>Account Actions</Heading3>
            
            <Card variant="flat" style={styles.dangerCard}>
              <CardContent style={styles.dangerCardContent}>
                <DangerAction
                  icon="log-out"
                  title="Sign Out"
                  description="Log out of your account"
                  onPress={handleSignOut}
                />
                
                <DangerAction
                  icon="trash-2"
                  title="Delete Account"
                  description="Permanently delete your account and all data"
                  destructive
                  onPress={() => setIsConfirmDeleteModalVisible(true)}
                />
              </CardContent>
            </Card>
          </View>
        </Animated.View>
      </ScrollView>
      
      {/* Email Modal */}
      <Modal
        visible={isEmailModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsEmailModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIsEmailModalVisible(false)}
            />
          </View>
          
          <Animated.View
            style={styles.modalContent}
            entering={SlideInRight.springify()}
          >
            <Heading3 style={styles.modalTitle}>Update Email</Heading3>
            
            <Input
              label="New Email"
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              iconName="mail"
              placeholder="Enter your new email"
            />
            
            <View style={styles.modalButtonContainer}>
              <Button
                variant="tertiary"
                onPress={() => setIsEmailModalVisible(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              
              <Button
                variant="primary"
                onPress={handleUpdateEmail}
                style={styles.modalButton}
              >
                Update
              </Button>
            </View>
          </Animated.View>
        </View>
      </Modal>
      
      {/* Password Modal */}
      <Modal
        visible={isPasswordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPasswordModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIsPasswordModalVisible(false)}
            />
          </View>
          
          <Animated.View
            style={styles.modalContent}
            entering={SlideInRight.springify()}
          >
            <Heading3 style={styles.modalTitle}>Update Password</Heading3>
            
            <Input
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              iconName="lock"
              placeholder="Enter your new password"
            />
            
            <Input
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              iconName="check"
              placeholder="Confirm your new password"
            />
            
            <View style={styles.modalButtonContainer}>
              <Button
                variant="tertiary"
                onPress={() => setIsPasswordModalVisible(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              
              <Button
                variant="primary"
                onPress={handleUpdatePassword}
                style={styles.modalButton}
                loading={isLoading}
              >
                Update
              </Button>
            </View>
          </Animated.View>
        </View>
      </Modal>
      
      {/* Profile Edit Modal */}
      <Modal
        visible={isProfileModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsProfileModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIsProfileModalVisible(false)}
            />
          </View>
          
          <Animated.View
            style={styles.modalContent}
            entering={SlideInRight.springify()}
          >
            <Heading3 style={styles.modalTitle}>Edit Profile</Heading3>
            
            <Input
              label="Name"
              value={profileName}
              onChangeText={setProfileName}
              iconName="user"
              placeholder="Enter your name"
            />
            
            <View style={styles.modalButtonContainer}>
              <Button
                variant="tertiary"
                onPress={() => setIsProfileModalVisible(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              
              <Button
                variant="primary"
                onPress={handleUpdateProfile}
                style={styles.modalButton}
              >
                Save
              </Button>
            </View>
          </Animated.View>
        </View>
      </Modal>
      
      {/* Account Deletion Confirmation Modal */}
      <Modal
        visible={isConfirmDeleteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsConfirmDeleteModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setIsConfirmDeleteModalVisible(false);
                setDeleteConfirmation("");
              }}
            />
          </View>
          
          <Animated.View
            style={[styles.modalContent, styles.deleteModalContent]}
            entering={SlideInRight.springify()}
          >
            <Heading3 style={styles.deleteModalTitle}>Delete Account</Heading3>
            
            <Body1 style={styles.deleteModalDescription}>
              This action cannot be undone. All your data will be permanently removed, including:
            </Body1>
            
            <View style={styles.deletionItemsList}>
              <View style={styles.deletionItem}>
                <Feather name="circle" size={8} color={theme.colors.text.secondary} />
                <Body2 style={styles.deletionItemText}>All conversation history</Body2>
              </View>
              
              <View style={styles.deletionItem}>
                <Feather name="circle" size={8} color={theme.colors.text.secondary} />
                <Body2 style={styles.deletionItemText}>Your profile information</Body2>
              </View>
              
              <View style={styles.deletionItem}>
                <Feather name="circle" size={8} color={theme.colors.text.secondary} />
                <Body2 style={styles.deletionItemText}>Custom scenarios you've created</Body2>
              </View>
              
              <View style={styles.deletionItem}>
                <Feather name="circle" size={8} color={theme.colors.text.secondary} />
                <Body2 style={styles.deletionItemText}>Learning progress and statistics</Body2>
              </View>
            </View>
            
            <Input
              label="Confirmation"
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              placeholder="Type DELETE to confirm"
              hint="Type DELETE in all caps to confirm account deletion"
            />
            
            <View style={styles.deleteButtonContainer}>
              <Button
                variant="tertiary"
                onPress={() => {
                  setIsConfirmDeleteModalVisible(false);
                  setDeleteConfirmation("");
                }}
                style={styles.deleteButton}
              >
                Cancel
              </Button>
              
              <Button
                variant="primary"
                style={[
                  styles.deleteButton,
                  styles.confirmDeleteButton
                ]}
                disabled={deleteConfirmation !== "DELETE" || isDeletingAccount}
                loading={isDeletingAccount}
                onPress={processAccountDeletion}
              >
                Delete Account
              </Button>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  profileHeaderCard: {
    marginBottom: 16,
  },
  profileHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    backfaceVisibility: "hidden",
  },
  profileInfo: {
    flex: 1,
  },
  lastActiveText: {
    marginTop: 4,
  },
  progressCard: {
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#E0E0E0",
  },
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(46, 125, 50, 0.1)", // Using primary color with opacity
    alignItems: "center",
    justifyContent: "center",
  },
  languageProgressContainer: {
    marginTop: 8,
  },
  languageProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  settingsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  settingsCard: {
    overflow: "hidden",
  },
  settingsCardContent: {
    padding: 0,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  settingsContent: {
    flex: 1,
  },
  dangerSection: {
    marginBottom: 32,
  },
  dangerCard: {
    backgroundColor: "#FEF2F2",
  },
  dangerCardContent: {
    padding: 0,
  },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#FEE2E2",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },
  deleteModalContent: {
    maxHeight: "80%",
  },
  modalTitle: {
    marginBottom: 24,
    textAlign: "center",
  },
  deleteModalTitle: {
    marginBottom: 16,
    color: "#EF4444",
  },
  deleteModalDescription: {
    marginBottom: 16,
    textAlign: "center",
  },
  deletionItemsList: {
    marginBottom: 24,
  },
  deletionItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  deletionItemText: {
    marginLeft: 8,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  deleteButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },
  deleteButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  confirmDeleteButton: {
    backgroundColor: "#EF4444",
  },
});