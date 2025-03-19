// app/(tabs)/profile.tsx
import {
    StyleSheet,
    Alert,
    Pressable,
    ScrollView,
    TextInput,
    Modal,
    View,
    ActivityIndicator,
  } from "react-native";
  import { useRouter } from "expo-router";
  import { useState, useEffect } from "react";
  import { ThemedView } from "@/components/ThemedView";
  import { ThemedText } from "@/components/ThemedText";
  import { useAppStore } from "@/hooks/useAppStore";
  import { SafeAreaView } from "react-native-safe-area-context";
  import { MetricsService } from "@/lib/services/metrics";
  import { supabase } from "@/lib/supabase/client";
  import { EncryptionService } from "@/lib/services/encryption";
  import { AuthService } from "@/lib/services/auth";
  
  export default function ProfileScreen() {
    const router = useRouter();
    const { user, setUser, setCurrentSession, setCurrentScenario } =
      useAppStore();
  
    const [isLoading, setIsLoading] = useState(true);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [metrics, setMetrics] = useState<any>(null);
    const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);
    const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
    const [isConfirmDeleteModalVisible, setIsConfirmDeleteModalVisible] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
  
    useEffect(() => {
      loadUserMetrics();
    }, [user?.id]);
  
    const loadUserMetrics = async () => {
      if (!user?.id) return;
  
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
  
    // Enhanced account deletion function
    const handleDeleteAccount = () => {
      setIsConfirmDeleteModalVisible(true);
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
  
    const renderStats = () => (
      <ThemedView style={styles.statsSection}>
        <ThemedText style={styles.sectionTitle}>Your Progress</ThemedText>
        <ThemedView style={styles.statsGrid}>
          <ThemedView style={styles.statBox}>
            <ThemedText style={styles.statNumber}>
              {isLoading ? "..." : metrics?.totalSessions || 0}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Total Sessions</ThemedText>
          </ThemedView>
          <ThemedView style={styles.statBox}>
            <ThemedText style={styles.statNumber}>
              {isLoading
                ? "..."
                : Math.round(metrics?.totalMinutesPracticed || 0)}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Minutes Practiced</ThemedText>
          </ThemedView>
          <ThemedView style={styles.statBox}>
            <ThemedText style={styles.statNumber}>
              {isLoading ? "..." : metrics?.streak || 0}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Day Streak</ThemedText>
          </ThemedView>
        </ThemedView>
      </ThemedView>
    );
  
    return (
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ThemedView style={styles.container}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            <ThemedView style={styles.header}>
              <ThemedText style={styles.email}>
                {user?.email || "Guest User"}
              </ThemedText>
              {metrics?.lastPracticed && (
                <ThemedText style={styles.lastActive}>
                  Last active:{" "}
                  {new Date(metrics.lastPracticed).toLocaleDateString()}
                </ThemedText>
              )}
            </ThemedView>
  
            {renderStats()}
  
            <ThemedView style={styles.section}>
              <ThemedText style={styles.sectionTitle}>
                Account Settings
              </ThemedText>
              <Pressable
                style={styles.button}
                onPress={() => setIsEmailModalVisible(true)}
              >
                <ThemedText style={styles.buttonText}>Update Email</ThemedText>
              </Pressable>
              <Pressable
                style={styles.button}
                onPress={() => setIsPasswordModalVisible(true)}
              >
                <ThemedText style={styles.buttonText}>Update Password</ThemedText>
              </Pressable>
            </ThemedView>
  
            <ThemedView style={[styles.section, styles.dangerSection]}>
              <Pressable style={styles.signOutButton} onPress={handleSignOut}>
                <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
              </Pressable>
  
              <Pressable
                style={styles.deleteButton}
                onPress={handleDeleteAccount}
                disabled={isDeletingAccount}
              >
                <ThemedText style={styles.deleteText}>
                  {isDeletingAccount ? "Deleting Account..." : "Delete Account"}
                </ThemedText>
              </Pressable>
            </ThemedView>
          </ScrollView>
          
          {/* Email Modal */}
          <Modal
            visible={isEmailModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setIsEmailModalVisible(false)}
          >
            <View style={styles.modalContainer}>
              <ThemedView style={styles.modalContent}>
                <ThemedText style={styles.modalTitle}>Update Email</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="New Email"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <View style={styles.modalButtons}>
                  <Pressable
                    style={styles.modalButton}
                    onPress={() => setIsEmailModalVisible(false)}
                  >
                    <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={handleUpdateEmail}
                  >
                    <ThemedText style={styles.modalButtonTextPrimary}>
                      Update
                    </ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
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
              <ThemedView style={styles.modalContent}>
                <ThemedText style={styles.modalTitle}>Update Password</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="New Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
                <View style={styles.modalButtons}>
                  <Pressable
                    style={styles.modalButton}
                    onPress={() => setIsPasswordModalVisible(false)}
                  >
                    <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={handleUpdatePassword}
                  >
                    <ThemedText style={styles.modalButtonTextPrimary}>
                      Update
                    </ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
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
              <ThemedView style={[styles.modalContent, styles.deleteModalContent]}>
                <ThemedText style={styles.deleteModalTitle}>Delete Account</ThemedText>
                
                <ThemedText style={styles.deleteModalDescription}>
                  This action cannot be undone. All your data will be permanently removed, including:
                </ThemedText>
  
                <View style={styles.deletionItemsList}>
                  <ThemedText style={styles.deletionItem}>• All conversation history</ThemedText>
                  <ThemedText style={styles.deletionItem}>• Your profile information</ThemedText>
                  <ThemedText style={styles.deletionItem}>• Custom scenarios you've created</ThemedText>
                  <ThemedText style={styles.deletionItem}>• Learning progress and statistics</ThemedText>
                </View>
                
                <ThemedText style={styles.confirmInstructions}>
                  Type DELETE to confirm:
                </ThemedText>
                
                <TextInput
                  style={styles.confirmInput}
                  value={deleteConfirmation}
                  onChangeText={setDeleteConfirmation}
                  placeholder="Type DELETE here"
                  autoCapitalize="characters"
                />
                
                <View style={styles.deleteModalButtons}>
                  <Pressable
                    style={styles.cancelDeleteButton}
                    onPress={() => {
                      setIsConfirmDeleteModalVisible(false);
                      setDeleteConfirmation("");
                    }}
                  >
                    <ThemedText style={styles.cancelDeleteText}>Cancel</ThemedText>
                  </Pressable>
                  
                  <Pressable
                    style={[
                      styles.confirmDeleteButton,
                      (deleteConfirmation !== "DELETE" || isDeletingAccount) && styles.disabledButton
                    ]}
                    onPress={processAccountDeletion}
                    disabled={deleteConfirmation !== "DELETE" || isDeletingAccount}
                  >
                    {isDeletingAccount ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <ThemedText style={styles.confirmDeleteText}>
                        Delete My Account
                      </ThemedText>
                    )}
                  </Pressable>
                </View>
              </ThemedView>
            </View>
          </Modal>
        </ThemedView>
      </SafeAreaView>
    );
  }
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#fff",
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    header: {
      padding: 20,
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#ccc",
    },
    email: {
      fontSize: 18,
      fontWeight: "600",
    },
    lastActive: {
      fontSize: 14,
      opacity: 0.6,
      marginTop: 4,
    },
    statsSection: {
      padding: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#ccc",
    },
    section: {
      padding: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "#ccc",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 15,
    },
    statsGrid: {
      flexDirection: "row",
      justifyContent: "space-around",
    },
    statBox: {
      alignItems: "center",
      padding: 15,
      borderRadius: 12,
      flex: 1,
      margin: 5,
      backgroundColor: "#f8f9fa",
    },
    statNumber: {
      fontSize: 24,
      fontWeight: "bold",
    },
    statLabel: {
      fontSize: 12,
      opacity: 0.7,
      marginTop: 4,
      textAlign: "center",
    },
    button: {
      backgroundColor: "#f8f9fa",
      padding: 15,
      borderRadius: 8,
      marginBottom: 10,
    },
    buttonText: {
      fontSize: 16,
    },
    dangerSection: {
      borderBottomWidth: 0,
      marginTop: 20,
    },
    signOutButton: {
      backgroundColor: "#007AFF",
      padding: 15,
      borderRadius: 8,
      alignItems: "center",
      marginBottom: 10,
    },
    signOutText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    deleteButton: {
      padding: 15,
      borderRadius: 8,
      alignItems: "center",
    },
    deleteText: {
      color: "#ff3b30",
      fontSize: 16,
    },
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalContent: {
      width: "80%",
      backgroundColor: "#fff",
      borderRadius: 12,
      padding: 20,
    },
    deleteModalContent: {
      width: "90%",
      maxHeight: "80%",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 20,
      textAlign: "center",
    },
    deleteModalTitle: {
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 15,
      textAlign: "center",
      color: "#ff3b30",
    },
    deleteModalDescription: {
      fontSize: 16,
      lineHeight: 22,
      marginBottom: 15,
      textAlign: "center",
    },
    deletionItemsList: {
      marginBottom: 20,
      paddingHorizontal: 10,
    },
    deletionItem: {
      fontSize: 14,
      marginBottom: 8,
      lineHeight: 20,
    },
    confirmInstructions: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 10,
      textAlign: "center",
    },
    confirmInput: {
      height: 48,
      borderWidth: 1,
      borderColor: "#ccc",
      borderRadius: 8,
      paddingHorizontal: 12,
      marginBottom: 20,
      fontSize: 16,
      textAlign: "center",
    },
    deleteModalButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    cancelDeleteButton: {
      flex: 1,
      padding: 15,
      alignItems: "center",
      marginRight: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#ccc",
    },
    cancelDeleteText: {
      fontSize: 16,
      color: "#666",
    },
    confirmDeleteButton: {
      flex: 1,
      padding: 15,
      backgroundColor: "#ff3b30",
      alignItems: "center",
      borderRadius: 8,
    },
    confirmDeleteText: {
      fontSize: 16,
      color: "#fff",
      fontWeight: "600",
    },
    disabledButton: {
      opacity: 0.5,
    },
    input: {
      height: 48,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#ccc",
      marginBottom: 16,
      paddingHorizontal: 16,
      backgroundColor: "#fff",
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    modalButton: {
      flex: 1,
      padding: 15,
      borderRadius: 8,
      alignItems: "center",
      marginHorizontal: 5,
    },
    modalButtonPrimary: {
      backgroundColor: "#007AFF",
    },
    modalButtonText: {
      color: "#007AFF",
      fontSize: 16,
    },
    modalButtonTextPrimary: {
      color: "#fff",
      fontSize: 16,
    },

  });