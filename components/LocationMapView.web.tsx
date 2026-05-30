/**
 * Web-only implementation of LocationMapView.
 * Avoids importing react-native-maps so the web bundle builds successfully.
 * Metro resolves this file when platform=web (index.bundle?platform=web).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface LocationMapViewProps {
  style?: any;
  showUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  onRegionChangeComplete?: (region: Region) => void;
}

export default function LocationMapView({
  style,
}: LocationMapViewProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
});
