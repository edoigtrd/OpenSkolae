import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme';

import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { AgendaScreen } from '../screens/AgendaScreen';
import { GradesScreen } from '../screens/GradesScreen';
import { AbsencesScreen } from '../screens/AbsencesScreen';
import { CoursesScreen } from '../screens/CoursesScreen';
import { CourseDetailScreen } from '../screens/CourseDetailScreen';
import { ProjectDetailScreen } from '../screens/ProjectDetailScreen';
import { NewsScreen } from '../screens/NewsScreen';
import { NewsDetailScreen } from '../screens/NewsDetailScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { SpeedMeetingsScreen } from '../screens/SpeedMeetingsScreen';
import { PartnersScreen } from '../screens/PartnersScreen';
import { SuggestionScreen } from '../screens/SuggestionScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const NAV_THEME = {
  headerStyle: { backgroundColor: Colors.surface },
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 18, color: Colors.textPrimary },
  headerTintColor: Colors.primary,
  headerShadowVisible: false,
  headerBackTitleVisible: false,
};

function CoursesStack() {
  return (
    <Stack.Navigator screenOptions={NAV_THEME}>
      <Stack.Screen name="CoursesList" component={CoursesScreen} options={{ title: 'Matières' }} />
      <Stack.Screen name="CourseDetail" component={CourseDetailScreen} options={({ route }: any) => ({ title: route.params?.course?.name || 'Matière' })} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={({ route }: any) => ({ title: route.params?.project?.name || 'Projet' })} />
    </Stack.Navigator>
  );
}

function NewsStack() {
  return (
    <Stack.Navigator screenOptions={NAV_THEME}>
      <Stack.Screen name="NewsList" component={NewsScreen} options={{ title: 'Actualités' }} />
      <Stack.Screen name="NewsDetail" component={NewsDetailScreen} options={({ route }: any) => ({ title: route.params?.news?.title || 'Actualité' })} />
    </Stack.Navigator>
  );
}

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: Colors.surface,
          paddingBottom: 8,
          height: 62,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, focused }) => {
          const icons: Record<string, { default: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }> = {
            Home: { default: 'home-outline', active: 'home' },
            Agenda: { default: 'calendar-outline', active: 'calendar' },
            Grades: { default: 'bar-chart-outline', active: 'bar-chart' },
            Absences: { default: 'alert-circle-outline', active: 'alert-circle' },
            Courses: { default: 'book-outline', active: 'book' },
          };
          const iconSet = icons[route.name] || { default: 'ellipse-outline', active: 'ellipse' };
          return <Ionicons name={focused ? iconSet.active : iconSet.default} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeTabStack} options={{ title: 'Accueil' }} />
      <Tab.Screen name="Agenda" component={AgendaTabStack} options={{ title: 'Agenda' }} />
      <Tab.Screen name="Grades" component={GradesTabStack} options={{ title: 'Notes' }} />
      <Tab.Screen name="Absences" component={AbsencesTabStack} options={{ title: 'Absences' }} />
      <Tab.Screen name="Courses" component={CoursesTabStack} options={{ title: 'Matières' }} />
    </Tab.Navigator>
  );
}

function HomeTabStack() {
  return (
    <Stack.Navigator screenOptions={NAV_THEME}>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ title: 'Accueil' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Mon profil' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="Documents" component={DocumentsScreen} options={{ title: 'Mes documents' }} />
      <Stack.Screen name="SpeedMeetings" component={SpeedMeetingsScreen} options={{ title: 'Speed Meetings' }} />
      <Stack.Screen name="Partners" component={PartnersScreen} options={{ title: 'Partenaires' }} />
      <Stack.Screen name="Suggestion" component={SuggestionScreen} options={{ title: 'Suggestion' }} />
      <Stack.Screen name="News" component={NewsScreen} options={{ title: 'Actualités' }} />
      <Stack.Screen name="NewsDetail" component={NewsDetailScreen} options={({ route }: any) => ({ title: '' })} />
    </Stack.Navigator>
  );
}

function AgendaTabStack() {
  return (
    <Stack.Navigator screenOptions={NAV_THEME}>
      <Stack.Screen name="AgendaMain" component={AgendaScreen} options={{ title: 'Agenda' }} />
    </Stack.Navigator>
  );
}

function GradesTabStack() {
  return (
    <Stack.Navigator screenOptions={NAV_THEME}>
      <Stack.Screen name="GradesMain" component={GradesScreen} options={{ title: 'Notes' }} />
    </Stack.Navigator>
  );
}

function AbsencesTabStack() {
  return (
    <Stack.Navigator screenOptions={NAV_THEME}>
      <Stack.Screen name="AbsencesMain" component={AbsencesScreen} options={{ title: 'Absences' }} />
    </Stack.Navigator>
  );
}

function CoursesTabStack() {
  return (
    <Stack.Navigator screenOptions={NAV_THEME}>
      <Stack.Screen name="CoursesMain" component={CoursesScreen} options={{ title: 'Matières' }} />
      <Stack.Screen name="CourseDetail" component={CourseDetailScreen} options={({ route }: any) => ({ title: route.params?.course?.name || 'Matière' })} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={({ route }: any) => ({ title: route.params?.project?.name || 'Projet' })} />
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
        <ActivityIndicator size="large" color={Colors.white} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <Stack.Screen name="Main" component={HomeTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
