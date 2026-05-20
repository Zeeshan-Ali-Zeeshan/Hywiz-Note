import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';
import GoogleCalendarAuth from '../components/GoogleCalendarAuth';
import api from '../lib/api';
import {
  Palette,
  Sun,
  Plug,
  Database,
  Settings as SettingsIcon,
  Zap,
  User,
  Type,
  Save,
  Eye,
  EyeOff,
  Bell,
  Shield,
  Trash2,
  Download,
  Upload as UploadIcon
} from 'lucide-react';
import Button from '../components/common/Button';


const greetings = [
  'Good morning',
  'Hello',
  'Welcome back',
  'Greetings',
  'Hey'
];

const fontSizes = [
  { value: 'small', label: 'Small', description: '12px - Compact view' },
  { value: 'medium', label: 'Medium', description: '14px - Default size' },
  { value: 'large', label: 'Large', description: '16px - Easy reading' }
];

const layoutStyles = [
  { value: 'comfortable', label: 'Comfortable', description: 'More spacing between elements' },
  { value: 'compact', label: 'Compact', description: 'Tighter spacing for more content' },
  { value: 'spacious', label: 'Spacious', description: 'Maximum spacing for clarity' }
];


type SettingsTab = 'account' | 'appearance' | 'editor' | 'notifications' | 'integrations' | 'data';

const Settings: React.FC = () => {
  const { user, updatePreferences } = useAuthStore();
  const { theme, setTheme, openImportExportModal, fontSize, setFontSize, setLayoutStyle } = useUIStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [selectedGreeting, setSelectedGreeting] = useState<string>(user?.preferences?.greeting || 'Good morning');
  // Auto-migrate legacy 'dark'/'auto' to 'black'
  const currentTheme = theme === 'light' ? 'light' : 'black';
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'black'>(currentTheme);
  const [selectedFontSize, setSelectedFontSize] = useState<'small' | 'medium' | 'large'>(fontSize);
  const [selectedLayoutStyle, setSelectedLayoutStyle] = useState<'comfortable' | 'compact' | 'spacious'>(user?.preferences?.layoutStyle || 'comfortable');
  const [emailNotifications, setEmailNotifications] = useState<boolean>(user?.preferences?.emailNotifications ?? true);
  const [browserNotifications, setBrowserNotifications] = useState<boolean>(user?.preferences?.browserNotifications ?? true);
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(user?.preferences?.autoSaveInterval || 30);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');


  useEffect(() => {
    if (user?.preferences) {
      setSelectedGreeting(user.preferences.greeting || 'Good morning');
      setSelectedTheme(
        user.preferences.theme === 'light' ? 'light' : 'black'
      );
      setSelectedLayoutStyle(user.preferences.layoutStyle || 'comfortable');
      setEmailNotifications(user.preferences.emailNotifications ?? true);
      setBrowserNotifications(user.preferences.browserNotifications ?? true);
      setAutoSaveInterval(user.preferences.autoSaveInterval || 30);
    }
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || ''
      });
    }
  }, [user?.preferences, theme, user]);

  useEffect(() => {
    setSelectedTheme(theme === 'light' ? 'light' : 'black');
  }, [theme]);

  const handleThemeChange = (newTheme: 'light' | 'black') => {
    setSelectedTheme(newTheme);
    setTheme(newTheme);
  };

  const handleFontSizeChange = (newFontSize: 'small' | 'medium' | 'large') => {
    setSelectedFontSize(newFontSize);
    setFontSize(newFontSize);
  };

  const handleLayoutStyleChange = (newStyle: 'comfortable' | 'compact' | 'spacious') => {
    setSelectedLayoutStyle(newStyle);
    setLayoutStyle(newStyle);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updatePreferences({
        greeting: selectedGreeting,
        theme: selectedTheme,
        layoutStyle: selectedLayoutStyle,
        fontSize: selectedFontSize,
        emailNotifications,
        browserNotifications,
        autoSaveInterval
      });
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      return;
    }
    if (!passwordData.currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }

    try {
      setIsSaving(true);
      await api.put('/users/password', passwordData);
      setPasswordSuccess('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      console.error('Failed to change password:', error);
      setPasswordError(error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfileUpdate = async () => {
    try {
      setIsSaving(true);
      await api.put('/users/profile', profileData);
      // Update the user in the store
      const { updateUser } = useAuthStore.getState();
      updateUser(profileData);
      alert('Profile updated successfully');
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      alert(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    const password = prompt('Please enter your password to confirm account deletion:');
    if (!password) {
      return;
    }

    try {
      setIsSaving(true);
      await api.delete('/users/account', { data: { password } });
      alert('Account deleted successfully');
      // Logout and redirect to login
      const { logout } = useAuthStore.getState();
      logout();
      window.location.href = '/login';
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      alert(error.response?.data?.message || 'Failed to delete account');
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2 text-gray-900 dark:text-gray-100 black:text-gray-100">
          <SettingsIcon className="w-6 h-6" />
          Settings
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 black:text-gray-400 mt-1">
          Customize your experience, manage your account, and configure your preferences.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 black:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 black:border-gray-800 flex overflow-hidden">
        <aside className="w-64 bg-gray-50 dark:bg-gray-900 black:bg-gray-950 border-r border-gray-200 dark:border-gray-700 black:border-gray-800 p-4">
          <nav className="space-y-2">
            {[
              { id: 'account', label: 'Account', icon: User },
              { id: 'appearance', label: 'Appearance', icon: Palette },
              { id: 'editor', label: 'Editor', icon: Type },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'integrations', label: 'Integrations', icon: Plug },
              { id: 'data', label: 'Data & Backup', icon: Database }
            ].map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${activeTab === tab.id
                    ? theme === 'light'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-800 text-white'
                    : theme === 'light'
                      ? 'text-gray-700 hover:bg-gray-100'
                      : 'text-gray-300 hover:bg-gray-700'
                    }`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6 space-y-8">
          {/* Account Settings */}
          {activeTab === 'account' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 black:text-gray-100">Profile Information</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2">Name</label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 black:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900 black:bg-gray-950 text-gray-900 dark:text-gray-100 black:text-gray-100"
                      placeholder="Enter your name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2">Email</label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 black:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900 black:bg-gray-950 text-gray-900 dark:text-gray-100 black:text-gray-100"
                      placeholder="Enter your email"
                    />
                  </div>
                  <Button
                    onClick={handleProfileUpdate}
                    disabled={isSaving}
                    variant="primary"
                    leftIcon={<User className="w-4 h-4" />}
                    isLoading={isSaving}
                  >
                    Update Profile
                  </Button>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 black:text-gray-100">Change Password</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2">Current Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-700 black:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900 black:bg-gray-950 text-gray-900 dark:text-gray-100 black:text-gray-100"
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2">New Password</label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 black:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900 black:bg-gray-950 text-gray-900 dark:text-gray-100 black:text-gray-100"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 black:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900 black:bg-gray-950 text-gray-900 dark:text-gray-100 black:text-gray-100"
                      placeholder="Confirm new password"
                    />
                  </div>
                  {passwordError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 black:bg-red-900/10 border border-red-200 dark:border-red-800 black:border-red-800 rounded-md">
                      <p className="text-sm text-red-600 dark:text-red-400 black:text-red-400">{passwordError}</p>
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 black:bg-green-900/10 border border-green-200 dark:border-green-800 black:border-green-800 rounded-md">
                      <p className="text-sm text-green-600 dark:text-green-400 black:text-green-400">{passwordSuccess}</p>
                    </div>
                  )}
                  <Button
                    onClick={handlePasswordChange}
                    disabled={isSaving}
                    variant="primary"
                    leftIcon={<Shield className="w-4 h-4" />}
                    isLoading={isSaving}
                  >
                    Change Password
                  </Button>
                </div>
              </div>
            </section>
          )}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 black:text-gray-100">Theme</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: 'light', label: 'Light', icon: Sun, description: 'Clean and bright interface' },
                    { id: 'black', label: 'Black', icon: Zap, description: 'Dark theme with #181818 sidebar and #242424 content' }
                  ].map((opt) => {
                    const IconComponent = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleThemeChange(opt.id as 'light' | 'black')}
                        className={`p-4 border-2 rounded-lg flex flex-col items-center gap-2 transition-colors ${selectedTheme === opt.id
                          ? theme === 'light'
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-500 bg-gray-800 text-white'
                          : theme === 'light'
                            ? 'border-gray-200 hover:border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                            : 'border-gray-600 hover:border-gray-500 bg-gray-900 text-gray-300 hover:bg-gray-800'
                          }`}
                      >
                        <IconComponent className="w-6 h-6" />
                        <span className="text-sm font-medium">{opt.label}</span>
                        <span className={`text-xs text-center ${selectedTheme === opt.id
                          ? theme === 'light'
                            ? 'text-blue-600'
                            : 'text-gray-300'
                          : theme === 'light'
                            ? 'text-gray-500'
                            : 'text-gray-400'
                          }`}>
                          {opt.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 black:text-gray-100">Layout Style</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {layoutStyles.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => handleLayoutStyleChange(style.value as 'comfortable' | 'compact' | 'spacious')}
                      className={`p-4 border-2 rounded-lg text-left transition-colors ${selectedLayoutStyle === style.value
                        ? theme === 'light'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-500 bg-gray-800 text-white'
                        : theme === 'light'
                          ? 'border-gray-200 hover:border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          : 'border-gray-600 hover:border-gray-500 bg-gray-900 text-gray-300 hover:bg-gray-800'
                        }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100 black:text-gray-100">{style.label}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 black:text-gray-400 mt-1">{style.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Editor Settings */}
          {activeTab === 'editor' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 black:text-gray-100">Font Size</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {fontSizes.map((size) => (
                    <button
                      key={size.value}
                      onClick={() => handleFontSizeChange(size.value as 'small' | 'medium' | 'large')}
                      className={`p-4 border-2 rounded-lg text-left transition-colors ${selectedFontSize === size.value
                        ? theme === 'light'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-500 bg-gray-800 text-white'
                        : theme === 'light'
                          ? 'border-gray-200 hover:border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          : 'border-gray-600 hover:border-gray-500 bg-gray-900 text-gray-300 hover:bg-gray-800'
                        }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100 black:text-gray-100">{size.label}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 black:text-gray-400 mt-1">{size.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 black:text-gray-100">Auto-save Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2">
                      Auto-save Interval (seconds)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="300"
                      value={autoSaveInterval}
                      onChange={(e) => setAutoSaveInterval(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 black:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900 black:bg-gray-950 text-gray-900 dark:text-gray-100 black:text-gray-100"
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400 black:text-gray-400 mt-1">
                      How often to automatically save your notes (5-300 seconds)
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 black:text-gray-100">Greeting Message</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {greetings.map((greeting) => (
                    <button
                      key={greeting}
                      onClick={() => setSelectedGreeting(greeting)}
                      className={`p-3 border rounded-lg text-left transition-colors ${selectedGreeting === greeting
                        ? theme === 'light'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-500 bg-gray-800 text-white'
                        : theme === 'light'
                          ? 'border-gray-200 hover:border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          : 'border-gray-600 hover:border-gray-500 bg-gray-900 text-gray-300 hover:bg-gray-800'
                        }`}
                    >
                      {greeting}
                    </button>
                  ))}
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 mb-2">Custom Greeting</label>
                  <input
                    type="text"
                    value={selectedGreeting}
                    onChange={(e) => setSelectedGreeting(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 black:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900 black:bg-gray-950 text-gray-900 dark:text-gray-100 black:text-gray-100"
                    placeholder="Enter custom greeting"
                  />
                </div>
              </div>
            </section>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100 black:text-gray-100">Notification Preferences</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 black:border-gray-800 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 black:text-gray-100">Email Notifications</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 black:text-gray-400">Receive notifications via email</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailNotifications}
                        onChange={(e) => setEmailNotifications(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 black:border-gray-800 rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 black:text-gray-100">Browser Notifications</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 black:text-gray-400">Receive notifications in your browser</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={browserNotifications}
                        onChange={(e) => setBrowserNotifications(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Integrations Settings */}
          {activeTab === 'integrations' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100 black:text-gray-100">Google Calendar</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 black:text-gray-400 mb-4">Connect your account to sync events with your notes.</p>
                <div className="max-w-sm">
                  <GoogleCalendarAuth />
                </div>
              </div>
            </section>
          )}

          {/* Data & Backup Settings */}
          {activeTab === 'data' && (
            <section className="space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100 black:text-gray-100">Import & Export</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 black:text-gray-400 mb-4">Backup your notes or bring your data from other tools.</p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => openImportExportModal('import')}
                    variant="primary"
                    leftIcon={<UploadIcon className="w-4 h-4" />}
                  >
                    Import Notes
                  </Button>
                  <Button
                    onClick={() => openImportExportModal('export')}
                    variant="secondary"
                    leftIcon={<Download className="w-4 h-4" />}
                  >
                    Export Notes
                  </Button>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100 black:text-gray-100">Account Management</h2>
                <div className="space-y-4">
                  <div className="p-4 border border-red-200 dark:border-red-800 black:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20 black:bg-red-900/10">
                    <h3 className="font-medium text-red-800 dark:text-red-200 black:text-red-200 mb-2">Danger Zone</h3>
                    <p className="text-sm text-red-600 dark:text-red-400 black:text-red-400 mb-4">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                    <Button
                      onClick={handleDeleteAccount}
                      disabled={isSaving}
                      variant="danger"
                      leftIcon={<Trash2 className="w-4 h-4" />}
                      isLoading={isSaving}
                    >
                      Delete Account
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          variant="primary"
          leftIcon={<Save className="w-4 h-4" />}
          isLoading={isSaving}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
};

export default Settings;

