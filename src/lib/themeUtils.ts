// Theme utility functions for consistent theming across the app

export const getThemeClasses = (baseClasses: string, theme: 'light' | 'dark' | 'black' = 'light') => {
  const themeMap = {
    light: {
      bg: 'bg-white',
      bgSecondary: 'bg-gray-50',
      bgTertiary: 'bg-gray-100',
      text: 'text-gray-900',
      textSecondary: 'text-gray-700',
      textMuted: 'text-gray-500',
      border: 'border-gray-200',
      borderSecondary: 'border-gray-300',
      hover: 'hover:bg-gray-50',
      hoverBorder: 'hover:border-gray-300',
      focus: 'focus:ring-blue-500',
      button: {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white',
        secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
        outline: 'border border-gray-300 bg-transparent hover:bg-gray-50 text-gray-700',
        ghost: 'bg-transparent hover:bg-gray-100 text-gray-700',
        danger: 'bg-red-600 hover:bg-red-700 text-white',
        success: 'bg-green-600 hover:bg-green-700 text-white'
      }
    },
    dark: {
      bg: 'bg-gray-800',
      bgSecondary: 'bg-gray-900',
      bgTertiary: 'bg-gray-700',
      text: 'text-gray-100',
      textSecondary: 'text-gray-300',
      textMuted: 'text-gray-400',
      border: 'border-gray-700',
      borderSecondary: 'border-gray-600',
      hover: 'hover:bg-gray-700',
      hoverBorder: 'hover:border-gray-600',
      focus: 'focus:ring-blue-500',
      button: {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white',
        secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
        outline: 'border border-gray-600 bg-transparent hover:bg-gray-700 text-gray-300',
        ghost: 'bg-transparent hover:bg-gray-700 text-gray-300',
        danger: 'bg-red-600 hover:bg-red-700 text-white',
        success: 'bg-green-600 hover:bg-green-700 text-white'
      }
    },
    black: {
      bg: 'bg-gray-900',
      bgSecondary: 'bg-gray-950',
      bgTertiary: 'bg-gray-800',
      text: 'text-gray-100',
      textSecondary: 'text-gray-300',
      textMuted: 'text-gray-400',
      border: 'border-gray-800',
      borderSecondary: 'border-gray-700',
      hover: 'hover:bg-gray-800',
      hoverBorder: 'hover:border-gray-700',
      focus: 'focus:ring-blue-500',
      button: {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white',
        secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
        outline: 'border border-gray-700 bg-transparent hover:bg-gray-800 text-gray-300',
        ghost: 'bg-transparent hover:bg-gray-800 text-gray-300',
        danger: 'bg-red-600 hover:bg-red-700 text-white',
        success: 'bg-green-600 hover:bg-green-700 text-white'
      }
    }
  };

  const themeClasses = themeMap[theme];
  
  // Replace theme-specific classes in the base classes
  let result = baseClasses;
  
  // Replace common patterns
  result = result.replace(/bg-white/g, themeClasses.bg);
  result = result.replace(/bg-gray-50/g, themeClasses.bgSecondary);
  result = result.replace(/bg-gray-100/g, themeClasses.bgTertiary);
  result = result.replace(/text-gray-900/g, themeClasses.text);
  result = result.replace(/text-gray-700/g, themeClasses.textSecondary);
  result = result.replace(/text-gray-500/g, themeClasses.textMuted);
  result = result.replace(/border-gray-200/g, themeClasses.border);
  result = result.replace(/border-gray-300/g, themeClasses.borderSecondary);
  result = result.replace(/hover:bg-gray-50/g, themeClasses.hover);
  result = result.replace(/hover:border-gray-300/g, themeClasses.hoverBorder);
  
  return result;
};

export const getButtonClasses = (variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success', theme: 'light' | 'dark' | 'black' = 'light') => {
  const themeMap = {
    light: {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
      secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500',
      outline: 'border border-gray-300 bg-transparent hover:bg-gray-50 text-gray-700 focus:ring-blue-500',
      ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-blue-500',
      danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
      success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'
    },
    dark: {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
      secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500',
      outline: 'border border-gray-600 bg-transparent hover:bg-gray-700 text-gray-300 focus:ring-blue-500',
      ghost: 'bg-transparent hover:bg-gray-700 text-gray-300 focus:ring-blue-500',
      danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
      success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'
    },
    black: {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
      secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500',
      outline: 'border border-gray-700 bg-transparent hover:bg-gray-800 text-gray-300 focus:ring-blue-500',
      ghost: 'bg-transparent hover:bg-gray-800 text-gray-300 focus:ring-blue-500',
      danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
      success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'
    }
  };

  return themeMap[theme][variant];
};

export const getInputClasses = (theme: 'light' | 'dark' | 'black' = 'light') => {
  const themeMap = {
    light: 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500',
    dark: 'bg-gray-900 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500',
    black: 'bg-gray-950 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-blue-500'
  };

  return themeMap[theme];
};

export const getCardClasses = (theme: 'light' | 'dark' | 'black' = 'light') => {
  const themeMap = {
    light: 'bg-white border-gray-200 text-gray-900',
    dark: 'bg-gray-800 border-gray-700 text-gray-100',
    black: 'bg-gray-900 border-gray-800 text-gray-100'
  };

  return themeMap[theme];
};

export const getDropdownClasses = (theme: 'light' | 'dark' | 'black' = 'light') => {
  const themeMap = {
    light: 'bg-white border-gray-200 text-gray-900 shadow-lg',
    dark: 'bg-gray-800 border-gray-700 text-gray-100 shadow-lg',
    black: 'bg-gray-900 border-gray-800 text-gray-100 shadow-lg'
  };

  return themeMap[theme];
};
