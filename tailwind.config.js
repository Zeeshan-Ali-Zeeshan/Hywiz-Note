/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        evernote: {
          bg: '#22272B',
          card: '#2D333A',
          border: '#3A4046',
          accent: '#00A82D',
          text: '#F7F8FA',
          muted: '#A3A7AB',
          hover: '#23282D',
          active: '#1B1F23',
        },
        // Black theme colors
        black: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        evernote: ['Segoe UI', 'Helvetica Neue', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'bounce-in': 'bounceIn 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceIn: {
          '0%': { transform: 'scale(0.3)', opacity: '0' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#374151',
            a: {
              color: '#3b82f6',
              '&:hover': {
                color: '#2563eb',
              },
            },
            h1: {
              color: '#111827',
            },
            h2: {
              color: '#111827',
            },
            h3: {
              color: '#111827',
            },
            h4: {
              color: '#111827',
            },
            strong: {
              color: '#111827',
            },
            code: {
              color: '#dc2626',
              backgroundColor: '#f3f4f6',
              padding: '0.125rem 0.25rem',
              borderRadius: '0.25rem',
              fontWeight: '500',
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            blockquote: {
              borderLeftColor: '#d1d5db',
              color: '#6b7280',
            },
            hr: {
              borderColor: '#e5e7eb',
            },
            ol: {
              color: '#374151',
            },
            ul: {
              color: '#374151',
            },
            li: {
              color: '#374151',
            },
            table: {
              color: '#374151',
            },
            thead: {
              color: '#111827',
              borderBottomColor: '#d1d5db',
            },
            tbody: {
              tr: {
                borderBottomColor: '#e5e7eb',
              },
            },
          },
        },
        dark: {
          css: {
            color: '#d1d5db',
            a: {
              color: '#60a5fa',
              '&:hover': {
                color: '#93c5fd',
              },
            },
            h1: {
              color: '#f9fafb',
            },
            h2: {
              color: '#f9fafb',
            },
            h3: {
              color: '#f9fafb',
            },
            h4: {
              color: '#f9fafb',
            },
            strong: {
              color: '#f9fafb',
            },
            code: {
              color: '#fca5a5',
              backgroundColor: '#374151',
            },
            blockquote: {
              borderLeftColor: '#4b5563',
              color: '#9ca3af',
            },
            hr: {
              borderColor: '#4b5563',
            },
            ol: {
              color: '#d1d5db',
            },
            ul: {
              color: '#d1d5db',
            },
            li: {
              color: '#d1d5db',
            },
            table: {
              color: '#d1d5db',
            },
            thead: {
              color: '#f9fafb',
              borderBottomColor: '#4b5563',
            },
            tbody: {
              tr: {
                borderBottomColor: '#374151',
              },
            },
          },
        },
        black: {
          css: {
            color: '#e5e5e5',
            a: {
              color: '#60a5fa',
              '&:hover': {
                color: '#93c5fd',
              },
            },
            h1: {
              color: '#ffffff',
            },
            h2: {
              color: '#ffffff',
            },
            h3: {
              color: '#ffffff',
            },
            h4: {
              color: '#ffffff',
            },
            strong: {
              color: '#ffffff',
            },
            code: {
              color: '#fca5a5',
              backgroundColor: '#262626',
            },
            blockquote: {
              borderLeftColor: '#404040',
              color: '#a3a3a3',
            },
            hr: {
              borderColor: '#404040',
            },
            ol: {
              color: '#e5e5e5',
            },
            ul: {
              color: '#e5e5e5',
            },
            li: {
              color: '#e5e5e5',
            },
            table: {
              color: '#e5e5e5',
            },
            thead: {
              color: '#ffffff',
              borderBottomColor: '#404040',
            },
            tbody: {
              tr: {
                borderBottomColor: '#262626',
              },
            },
          },
        },
      },
      spacing: {
        'btn-h': '40px',
        'btn-px': '16px',
        'btn-py': '8px',
        'card-p': '16px',
        'gap': '12px',
        'gap-lg': '16px',
        'icon': '20px',
      },
      borderRadius: {
        'evernote': '8px',
      },
      fontSize: {
        'evernote-base': ['15px', '22px'],
        'evernote-title': ['20px', '28px'],
      },
      boxShadow: {
        'evernote': '0 1px 4px 0 rgba(0,0,0,0.10)',
      },
      strokeWidth: {
        'evernote': '1.5',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    function ({ addVariant }) {
      addVariant('black', '.black &');
    },
  ],
};
