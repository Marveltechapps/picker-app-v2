import { ScrollView, scrollViewTouchProps } from "@/utils/scrollables";
import { TouchableOpacity, TouchableCard } from "@/utils/touchables";
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Clock, DollarSign, CheckCircle, AlertTriangle, Info } from 'lucide-react-native';
import Header from '@/components/Header';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead as markAllReadApi,
  type ApiNotification,
} from '@/services/notifications.service';
import { useAuth } from '@/state/authContext';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';

type NotificationType = 'payout' | 'order' | 'shift' | 'training' | 'milestone' | 'bonus' | 'update';

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'payout':
    case 'bonus':
      return { Icon: DollarSign, bgColor: '#FEF3C7', iconColor: '#F59E0B' };
    case 'order':
    case 'milestone':
      return { Icon: CheckCircle, bgColor: '#D1FAE5', iconColor: '#10B981' };
    case 'shift':
      return { Icon: AlertTriangle, bgColor: '#FED7AA', iconColor: '#F97316' };
    case 'training':
    case 'update':
      return { Icon: Info, bgColor: '#E4E5F0', iconColor: '#121358' };
    default:
      return { Icon: Info, bgColor: '#E4E5F0', iconColor: '#121358' };
  }
};

export default function NotificationsScreen() {
  const { setNotifications } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [notifications, setLocalNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);

  const fetchNotifications = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const list = await getNotifications();
      setLocalNotifications(list);
      setNotifications(list.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        description: n.description ?? '',
        timestamp: n.timestamp,
        isRead: n.isRead,
      })));
    } catch {
      if (!opts?.silent) setLocalNotifications([]);
    } finally {
      if (!opts?.silent) setLoading(false);
      hasLoadedOnceRef.current = true;
    }
  }, [setNotifications]);

  const fetchNotificationsRef = useRef(fetchNotifications);
  fetchNotificationsRef.current = fetchNotifications;

  useFocusEffect(
    useCallback(() => {
      void fetchNotificationsRef.current({ silent: hasLoadedOnceRef.current });
    }, [])
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const totalCount = notifications.length;
  const filteredNotifications =
    filter === 'all' ? notifications : notifications.filter((n) => !n.isRead);

  const handleMarkAllAsRead = async () => {
    const ok = await markAllReadApi();
    if (ok) {
      setLocalNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  const handleMarkAsRead = async (id: string) => {
    const ok = await markNotificationRead(id);
    if (ok) {
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title="Notifications" subtitle={`${unreadCount} unread`} />
      
      <View style={styles.filterContainer}>
        <View style={styles.filterButtonsRow}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === 'all' && styles.filterButtonActive
            ]}
            onPress={() => setFilter('all')}
          >
            <Text style={[
              styles.filterText,
              filter === 'all' && styles.filterTextActive
            ]}>
              All ({totalCount})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              filter === 'unread' && styles.filterButtonActive
            ]}
            onPress={() => setFilter('unread')}
          >
            <Text style={[
              styles.filterText,
              filter === 'unread' && styles.filterTextActive
            ]}>
              Unread ({unreadCount})
            </Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          onPress={handleMarkAllAsRead}
          style={styles.markAllButton}
        >
          <Text style={styles.markAllRead}>Mark all</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        {...scrollViewTouchProps}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary[500]} />
          </View>
        ) : (
        filteredNotifications.map((notification) => {
          const { Icon, bgColor, iconColor } = getNotificationIcon(notification.type);
          
          return (
            <TouchableCard
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.isRead && styles.notificationCardUnread,
              ]}
              onPress={() => handleMarkAsRead(notification.id)}
            >
              <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
                <Icon size={24} color={iconColor} />
              </View>

              <View style={styles.notificationContent}>
                <View style={styles.titleRow}>
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  {!notification.isRead && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notificationDescription}>
                  {notification.description}
                </Text>
                <View style={styles.timestampRow}>
                  <Clock size={12} color="#9CA3AF" />
                  <Text style={styles.timestamp}>{notification.timestamp}</Text>
                </View>
              </View>
            </TouchableCard>
          );
        })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.white,
  },
  filterButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    flex: 1,
  },
  markAllButton: {
    padding: Spacing.sm,
  },
  markAllRead: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.primary[500],
  },
  filterButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray[100],
  },
  filterButtonActive: {
    backgroundColor: Colors.primary[500],
  },
  filterText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.text.secondary,
  },
  filterTextActive: {
    color: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  listContainer: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadows.sm,
  },
  notificationCardUnread: {
    borderColor: Colors.primary[500],
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000000',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#121358',
    marginLeft: 8,
  },
  notificationDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  loadingContainer: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});