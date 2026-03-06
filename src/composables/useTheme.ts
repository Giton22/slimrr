import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark' | 'system'

const theme = ref<Theme>((localStorage.getItem('theme') as Theme) || 'system')

function getSystemPreference(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(value: Theme) {
  const resolved = value === 'system' ? getSystemPreference() : value
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

// Watch for changes
watch(theme, (value) => {
  localStorage.setItem('theme', value)
  applyTheme(value)
}, { immediate: true })

// Listen for system preference changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (theme.value === 'system') {
    applyTheme('system')
  }
})

export function useTheme() {
  return {
    theme,
    setTheme(value: Theme) {
      theme.value = value
    },
  }
}
