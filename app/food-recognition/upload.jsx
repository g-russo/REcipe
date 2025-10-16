import React, { useState } from 'react';
import { View, Text, Button, Image, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { classifyImageAsync } from '../../services/food-recog-api';

export default function UploadScreen() {
  const router = useRouter();
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  };

  const analyze = async () => {
    if (!image) return;
    setBusy(true);
    try {
      const data = await classifyImageAsync(image.uri);
      router.push({
        pathname: '/food-recognition/result',
        params: { data: JSON.stringify(data), uri: image.uri },
      });
    } catch (e) {
      Alert.alert('Analysis failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, justifyContent: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '600', textAlign: 'center' }}>Food Recognition</Text>
      {image && <Image source={{ uri: image.uri }} style={{ width: '100%', height: 240, borderRadius: 8 }} />}
      <Button title="Pick from gallery" onPress={pickImage} />
      <Button title="Take a photo" onPress={takePhoto} />
      <Button title="Analyze" onPress={analyze} disabled={!image || busy} />
      {busy && <ActivityIndicator size="large" />}
    </View>
  );
}