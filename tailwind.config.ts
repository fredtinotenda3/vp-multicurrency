import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // VisionPlus Brand Colors (from existing system)
        'vp-primary': {
          50: '#e6e9f5',
          100: '#c0c8e6',
          200: '#97a5d5',
          300: '#6e82c4',
          400: '#4d68b6',
          500: '#2c4fa8', // Primary brand color
          600: '#27489f',
          700: '#213f95',
          800: '#1b368b',
          900: '#10267a',
          DEFAULT: '#002d68',
        },
        'vp-secondary': {
          50: '#e0f7fa',
          100: '#b2ebf2',
          200: '#80deea',
          300: '#4dd0e1',
          400: '#26c6da',
          500: '#00bcd4',
          600: '#00acc1',
          700: '#0097a7',
          800: '#00838f',
          900: '#006064',
          DEFAULT: '#1FAEC1',
        },
        'vp-accent': {
          50: '#fff8e1',
          100: '#ffecb3',
          200: '#ffe082',
          300: '#ffd54f',
          400: '#ffca28',
          500: '#ffc107',
          600: '#ffb300',
          700: '#ffa000',
          800: '#ff8f00',
          900: '#ff6f00',
          DEFAULT: '#f5c659',
        },
        // Currency Specific Colors
        'currency': {
          'usd': {
            50: '#e8f5e9',
            100: '#c8e6c9',
            200: '#a5d6a7',
            300: '#81c784',
            400: '#66bb6a',
            500: '#4caf50',
            600: '#43a047',
            700: '#388e3c',
            800: '#2e7d32',
            900: '#1b5e20',
            DEFAULT: '#28a745',
          },
          'zwl': {
            50: '#e1f5fe',
            100: '#b3e5fc',
            200: '#81d4fa',
            300: '#4fc3f7',
            400: '#29b6f6',
            500: '#03a9f4',
            600: '#039be5',
            700: '#0288d1',
            800: '#0277bd',
            900: '#01579b',
            DEFAULT: '#17a2b8',
          },
          'locked': {
            50: '#f3e5f5',
            100: '#e1bee7',
            200: '#ce93d8',
            300: '#ba68c8',
            400: '#ab47bc',
            500: '#9c27b0',
            600: '#8e24aa',
            700: '#7b1fa2',
            800: '#6a1b9a',
            900: '#4a148c',
            DEFAULT: '#6f42c1',
          },
        },
        // Status Colors
        'status': {
          'pending': {
            DEFAULT: '#ffc107',
            light: '#fff9e6',
            dark: '#856404',
          },
          'partial': {
            DEFAULT: '#fd7e14',
            light: '#fff3e6',
            dark: '#984c0c',
          },
          'cleared': {
            DEFAULT: '#28a745',
            light: '#f0fff4',
            dark: '#155724',
          },
          'error': {
            DEFAULT: '#dc3545',
            light: '#fff5f5',
            dark: '#721c24',
          },
        },
        // UI Colors
        'vp-background': '#f5f7fa',
        'vp-foreground': '#242424',
        'vp-surface': '#ffffff',
        'vp-border': '#d1d9e6',
        'vp-info': '#C1E4F2',
        'vp-success': '#6AD664',
        'vp-warning': '#FEB54C',
        'vp-danger': '#C46A5C',
      },
      fontFamily: {
        sans: ['"Droid Sans"', 'Arial', 'Helvetica', 'sans-serif'],
        mono: ['monospace'],
      },
      fontSize: {
        // Enterprise-appropriate font sizes
        'xs': ['12px', { lineHeight: '16px' }],
        'sm': ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg': ['18px', { lineHeight: '28px' }],
        'xl': ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '40px' }],
      },
      spacing: {
        // Consistent spacing scale
        '0': '0px',
        'px': '1px',
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '2.5': '10px',
        '3': '12px',
        '3.5': '14px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '9': '36px',
        '10': '40px',
        '11': '44px',
        '12': '48px',
        '14': '56px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
        '28': '112px',
        '32': '128px',
        '36': '144px',
        '40': '160px',
        '44': '176px',
        '48': '192px',
        '52': '208px',
        '56': '224px',
        '60': '240px',
        '64': '256px',
        '72': '288px',
        '80': '320px',
        '96': '384px',
      },
      borderRadius: {
        'none': '0',
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
        '3xl': '32px',
        'full': '9999px',
      },
      boxShadow: {
        // Enterprise-appropriate shadows
        'sm': '0 2px 4px rgba(0, 45, 104, 0.1)',
        'DEFAULT': '0 4px 8px rgba(0, 45, 104, 0.15)',
        'md': '0 4px 8px rgba(0, 45, 104, 0.15)',
        'lg': '0 8px 16px rgba(0, 45, 104, 0.2)',
        'xl': '0 12px 24px rgba(0, 45, 104, 0.25)',
        '2xl': '0 16px 32px rgba(0, 45, 104, 0.3)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        // Currency specific shadows
        'currency-usd': '0 2px 8px rgba(40, 167, 69, 0.2)',
        'currency-zwl': '0 2px 8px rgba(23, 162, 184, 0.2)',
        'currency-locked': '0 2px 8px rgba(111, 66, 193, 0.3)',
      },
      animation: {
        // Currency and status animations
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'currency-change': 'currencyChange 1s ease',
        'status-pulse': 'statusPulse 2s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-in',
        'fade-out': 'fadeOut 0.2s ease-out',
      },
      keyframes: {
        currencyChange: {
          '0%': { backgroundColor: 'white' },
          '50%': { backgroundColor: '#f0f8ff' },
          '100%': { backgroundColor: 'white' },
        },
        statusPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '300ms',
        'slow': '500ms',
      },
      screens: {
        // Enterprise breakpoints
        'xs': '480px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1400px', // Matches vp-container max-width
        '3xl': '1600px',
      },
      zIndex: {
        // Layering system for enterprise UI
        '0': '0',
        '10': '10',
        '20': '20',
        '30': '30',
        '40': '40',
        '50': '50',
        'dropdown': '1000',
        'sticky': '1020',
        'fixed': '1030',
        'modal-backdrop': '1040',
        'modal': '1050',
        'popover': '1060',
        'tooltip': '1070',
      },
      backgroundImage: {
        // Gradients for enterprise UI
        'vp-gradient': 'linear-gradient(135deg, #002d68 0%, #00408c 100%)',
        'vp-gradient-secondary': 'linear-gradient(135deg, #1FAEC1 0%, #26c6da 100%)',
        'currency-gradient-usd': 'linear-gradient(135deg, #28a745 0%, #34ce57 100%)',
        'currency-gradient-zwl': 'linear-gradient(135deg, #17a2b8 0%, #5bc0de 100%)',
      },
      gridTemplateColumns: {
        // Useful grid templates
        '13': 'repeat(13, minmax(0, 1fr))',
        '14': 'repeat(14, minmax(0, 1fr))',
        '15': 'repeat(15, minmax(0, 1fr))',
        '16': 'repeat(16, minmax(0, 1fr))',
        // Layout specific
        'vp-sidebar': '250px 1fr',
        'vp-receipt': '1fr 2fr 1fr',
      },
    },
  },
  plugins: [
    
    require('@tailwindcss/forms'), // For better form styling
    require('@tailwindcss/typography'), // For rich text content
    function({ addUtilities, theme }) {
      // Custom utility classes for VisionPlus
      const newUtilities = {
        // Currency utilities
        '.currency-badge': {
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
        },
        '.currency-usd': {
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          color: theme('colors.currency.usd.DEFAULT'),
          border: '1px solid rgba(40, 167, 69, 0.3)',
        },
        '.currency-zwl': {
          backgroundColor: 'rgba(23, 162, 184, 0.1)',
          color: theme('colors.currency.zwl.DEFAULT'),
          border: '1px solid rgba(23, 162, 184, 0.3)',
        },
        '.currency-locked': {
          backgroundColor: 'rgba(111, 66, 193, 0.1)',
          color: theme('colors.currency.locked.DEFAULT'),
          border: '1px solid rgba(111, 66, 193, 0.3)',
          borderLeftWidth: '4px',
          borderLeftColor: theme('colors.currency.locked.DEFAULT'),
        },
        // Status badges
        '.status-badge': {
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
        },
        '.status-pending': {
          backgroundColor: 'rgba(255, 193, 7, 0.1)',
          color: '#856404',
          border: '1px solid rgba(255, 193, 7, 0.3)',
        },
        '.status-partial': {
          backgroundColor: 'rgba(253, 126, 20, 0.1)',
          color: '#984c0c',
          border: '1px solid rgba(253, 126, 20, 0.3)',
        },
        '.status-cleared': {
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          color: '#155724',
          border: '1px solid rgba(40, 167, 69, 0.3)',
        },
        // Exchange rate display
        '.exchange-rate-display': {
          backgroundColor: '#f8f9fa',
          border: '1px solid #d1d9e6',
          borderRadius: '8px',
          padding: '16px',
          margin: '16px 0',
        },
        '.exchange-rate-locked': {
          backgroundColor: '#f0e6ff',
          border: '2px solid #6f42c1',
          borderLeftWidth: '6px',
          borderLeftColor: '#6f42c1',
        },
        // Amount display
        '.amount-display': {
          fontSize: '18px',
          fontWeight: 'bold',
          padding: '8px 16px',
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #d1d9e6',
        },
        '.amount-primary': {
          color: '#002d68',
          fontSize: '24px',
        },
        // Transaction summary
        '.transaction-summary': {
          backgroundColor: 'white',
          border: '1px solid #d1d9e6',
          borderRadius: '12px',
          padding: '24px',
        },
        '.summary-row': {
          display: 'flex',
          justifyContent: 'space-between',
          padding: '10px 0',
          borderBottom: '1px solid #f8f9fa',
        },
        '.summary-total': {
          borderBottom: 'none',
          fontWeight: 'bold',
          fontSize: '16px',
          paddingTop: '16px',
          borderTop: '2px solid #d1d9e6',
        },
        // Card components
        '.vp-card': {
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 8px rgba(0, 45, 104, 0.15)',
          border: '1px solid #d1d9e6',
          marginBottom: '24px',
          overflow: 'hidden',
        },
        '.vp-card-header': {
          background: 'linear-gradient(to right, #002d68, #1FAEC1)',
          color: 'white',
          padding: '16px 24px',
          fontSize: '16px',
          fontWeight: 'bold',
        },
        // Form controls
        '.vp-form-control': {
          width: '100%',
          padding: '10px 12px',
          border: '1px solid #d1d9e6',
          borderRadius: '8px',
          fontSize: '14px',
          fontFamily: '"Droid Sans", Arial, Helvetica, sans-serif',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          backgroundColor: 'white',
        },
        '.vp-form-control:focus': {
          outline: 'none',
          borderColor: '#1FAEC1',
          boxShadow: '0 0 0 3px rgba(31, 174, 193, 0.1)',
        },
        // Print utilities
        '.print-hide': {
          '@media print': {
            display: 'none !important',
          },
        },
        '.print-only': {
          display: 'none',
          '@media print': {
            display: 'block',
          },
        },
        '.receipt-print': {
          '@media print': {
            border: 'none',
            boxShadow: 'none',
            padding: '20px',
          },
        },
      }
      
      addUtilities(newUtilities, ['responsive', 'hover', 'focus', 'print'])
    },
  ],
  // Safelist for dynamic currency and status classes
  safelist: [
    // Currency badges
    'currency-usd',
    'currency-zwl',
    'currency-locked',
    // Status badges
    'status-pending',
    'status-partial',
    'status-cleared',
    'status-error',
    // Background colors
    'bg-currency-usd',
    'bg-currency-zwl',
    'bg-currency-locked',
    'bg-status-pending',
    'bg-status-partial',
    'bg-status-cleared',
    // Text colors
    'text-currency-usd',
    'text-currency-zwl',
    'text-currency-locked',
    'text-status-pending',
    'text-status-partial',
    'text-status-cleared',
    // Border colors
    'border-currency-usd',
    'border-currency-zwl',
    'border-currency-locked',
    // Animations
    'animate-currency-change',
    'animate-status-pulse',
  ],
}

export default config;