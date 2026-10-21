import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, View } from 'react-native';
import { MatchesScreen } from './src/screens/MatchesScreen';

export default function App() {
  return (
    <View style={styles.root}>
      <MatchesScreen />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: Platform.OS === 'web' ? 12 : 48,
    backgroundColor: '#0f151b',
  },
});
