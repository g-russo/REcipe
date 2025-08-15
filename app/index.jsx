import { StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import { useSupabase } from '../hooks/useSupabase';
import { useAuth } from '../hooks/useAuth';
import { router } from 'expo-router';

const Home = () => {
  const { loading, error, testConnection } = useSupabase();
  const { user, signOut } = useAuth();

  const handleTestConnection = async () => {
    try {
      await testConnection();
      Alert.alert('Success', 'Connected to Supabase successfully!');
    } catch (err) {
      Alert.alert('Error', `Failed to connect: ${err.message}`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      Alert.alert('Success', 'Signed out successfully!');
    } catch (err) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const goToSignUp = () => {
    router.push('/signup');
  };

  const goToSignIn = () => {
    router.push('/signin');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Recipe App!</Text>
      
      {user ? (
        <View style={styles.userSection}>
          <Text style={styles.userText}>Signed in as: {user.email}</Text>
          <TouchableOpacity style={styles.button} onPress={handleSignOut}>
            <Text style={styles.buttonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.authSection}>
          <TouchableOpacity style={styles.button} onPress={goToSignUp}>
            <Text style={styles.buttonText}>Sign Up</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={goToSignIn}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <TouchableOpacity 
        style={styles.button} 
        onPress={handleTestConnection}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Testing Connection...' : 'Test Supabase Connection'}
        </Text>
      </TouchableOpacity>
      
      {error && (
        <Text style={styles.errorText}>Error: {error}</Text>
      )}
    </View>
  );
}

export default Home

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  userSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  userText: {
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
  },
  authSection: {
    width: '100%',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
  },
});