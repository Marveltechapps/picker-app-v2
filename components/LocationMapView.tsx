import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useLocation } from '@/state/locationContext';

function buildOpenStreetMapEmbedUrl(lat: number, lng: number, delta = 0.005) {
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat},${lng}`;
}

// Lazy-load MapView only when needed (native platforms).
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;
let PROVIDER_DEFAULT: any = null;
let mapsLoaded = false;

function tryLoadMaps(): boolean {
  if (Platform.OS === 'web') return false;
  if (mapsLoaded) return !!MapView;
  mapsLoaded = true;
  try {
    const Maps = require('react-native-maps');
    MapView = Maps.default || Maps;
    Marker = Maps.Marker;
    PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
    PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
    return !!MapView;
  } catch {
    return false;
  }
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapLocationMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  pinColor?: string;
}

interface LocationMapViewProps {
  style?: any;
  showUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  /** When true, map centers on and follows device location in realtime */
  followsUserLocation?: boolean;
  preferGoogleProvider?: boolean;
  markers?: MapLocationMarker[];
  onRegionChangeComplete?: (region: Region) => void;
}

export default function LocationMapView({
  style,
  showUserLocation = true,
  showsMyLocationButton = false,
  showsCompass = false,
  followsUserLocation = false,
  preferGoogleProvider = false,
  markers = [],
  onRegionChangeComplete,
}: LocationMapViewProps) {
  const { currentLocation, locationPermission } = useLocation();
  const mapRef = useRef<InstanceType<typeof MapView> | null>(null);

  // Zoom level for "exact" device location (0.005 ≈ 500m – close enough to show precise position)
  const LOCATION_ZOOM_DELTA = 0.005;

  // Update map region in realtime when location changes (native only)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (currentLocation && mapRef.current && followsUserLocation) {
      try {
        const region: Region = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: LOCATION_ZOOM_DELTA,
          longitudeDelta: LOCATION_ZOOM_DELTA,
        };
        mapRef.current.animateToRegion(region, 500);
      } catch (err) {
        if (__DEV__) console.warn('Error animating map to region:', err);
      }
    }
  }, [currentLocation, followsUserLocation]);

  // Initial region (fallback to default if no current location)
  const initialRegion: Region = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: LOCATION_ZOOM_DELTA,
        longitudeDelta: LOCATION_ZOOM_DELTA,
      }
    : {
        latitude: 12.9716,
        longitude: 77.5946,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  // Web: show embedded OpenStreetMap with device location (realtime via context)
  if (Platform.OS === 'web') {
    const lat = currentLocation?.latitude ?? 12.9716;
    const lng = currentLocation?.longitude ?? 77.5946;
    const embedUrl = buildOpenStreetMapEmbedUrl(lat, lng);
    return (
      <View style={[styles.container, style]}>
        <iframe
          src={embedUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 0,
            borderRadius: 0,
          }}
          title="Your location"
        />
      </View>
    );
  }

  // Native: if MapView failed to load, show placeholder
  const mapsAvailable = tryLoadMaps();
  if (!mapsAvailable || !MapView) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.webPlaceholder} />
      </View>
    );
  }

  const mapProvider = preferGoogleProvider && PROVIDER_GOOGLE ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={mapProvider}
        initialRegion={initialRegion}
        showsUserLocation={showUserLocation && locationPermission === 'granted'}
        showsMyLocationButton={showsMyLocationButton}
        showsCompass={showsCompass}
        followsUserLocation={followsUserLocation}
        onRegionChangeComplete={onRegionChangeComplete}
        mapType="standard"
        loadingEnabled={true}
      >
        {/* Custom marker only when native user location is disabled; otherwise native blue dot shows exact position */}
        {currentLocation && Marker && !(showUserLocation && locationPermission === 'granted') && (
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            title="Your Location"
            description={currentLocation.accuracy ? `±${Math.round(currentLocation.accuracy)}m` : 'N/A'}
            pinColor="#6366F1"
          />
        )}
        {Marker
          ? markers.map((marker) => (
              <Marker
                key={marker.id}
                coordinate={{
                  latitude: marker.latitude,
                  longitude: marker.longitude,
                }}
                title={marker.title}
                description={marker.description}
                pinColor={marker.pinColor || "#6366F1"}
              />
            ))
          : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  webPlaceholder: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
});
