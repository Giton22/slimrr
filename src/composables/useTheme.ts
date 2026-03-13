import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'
export type ColorTheme = 'classic' | 'darcula' | 'nord' | 'solarized' | 'gruvbox'

export const COLOR_THEMES = [
  { value: 'classic', label: 'Classic' },
  { value: 'darcula', label: 'Darcula' },
  { value: 'nord', label: 'Nord' },
  { value: 'solarized', label: 'Solarized' },
  { value: 'gruvbox', label: 'Gruvbox' },
] as const

type ThemeConfig = {
  defaultTheme?: Theme
  defaultColorTheme?: ColorTheme
  storageKey?: string
  colorThemeStorageKey?: string
}

const DEFAULT_STORAGE_KEY = 'vite-ui-theme'
const DEFAULT_COLOR_THEME_STORAGE_KEY = 'vite-ui-color-theme'
const mql = window.matchMedia('(prefers-color-scheme: dark)')

const theme = ref<Theme>('dark')
const colorTheme = ref<ColorTheme>('classic')
let modeStorageKey = DEFAULT_STORAGE_KEY
let paletteStorageKey = DEFAULT_COLOR_THEME_STORAGE_KEY
let initialized = false

function getSystemPreference(): 'light' | 'dark' {
  return mql.matches ? 'dark' : 'light'
}

function readStoredTheme(defaultTheme: Theme): Theme {
  const storedTheme = localStorage.getItem(modeStorageKey) ?? localStorage.getItem('theme')
  if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
    return storedTheme
  }

  return defaultTheme
}

function readStoredColorTheme(defaultColorTheme: ColorTheme): ColorTheme {
  const storedColorTheme = localStorage.getItem(paletteStorageKey)
  if (storedColorTheme === 'classic' || storedColorTheme === 'darcula' || storedColorTheme === 'nord' || storedColorTheme === 'solarized' || storedColorTheme === 'gruvbox') {
    return storedColorTheme
  }

  return defaultColorTheme
}

function applyTheme(value: Theme) {
  const resolved = value === 'system' ? getSystemPreference() : value
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
}

function applyColorTheme(value: ColorTheme) {
  document.documentElement.dataset.theme = value
}

function handleSystemThemeChange() {
  if (theme.value === 'system') {
    applyTheme('system')
  }
}

export function initializeTheme({
  defaultTheme = 'dark',
  defaultColorTheme = 'classic',
  storageKey = DEFAULT_STORAGE_KEY,
  colorThemeStorageKey = DEFAULT_COLOR_THEME_STORAGE_KEY,
}: ThemeConfig = {}) {
  modeStorageKey = storageKey
  paletteStorageKey = colorThemeStorageKey
  theme.value = readStoredTheme(defaultTheme)
  colorTheme.value = readStoredColorTheme(defaultColorTheme)

  if (!initialized) {
    watch(theme, (value) => {
      localStorage.setItem(modeStorageKey, value)
      applyTheme(value)
    }, { immediate: true })

    watch(colorTheme, (value) => {
      localStorage.setItem(paletteStorageKey, value)
      applyColorTheme(value)
    }, { immediate: true })

    mql.addEventListener('change', handleSystemThemeChange)
    initialized = true
    return
  }

  applyTheme(theme.value)
  applyColorTheme(colorTheme.value)
}

export function useTheme() {
  if (!initialized) {
    initializeTheme()
  }

  return {
    theme,
    colorTheme,
    colorThemes: COLOR_THEMES,
    setTheme(value: Theme) {
      theme.value = value
    },
    setColorTheme(value: ColorTheme) {
      colorTheme.value = value
    },
  }
}
