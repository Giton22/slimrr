import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import 'vue-sonner/style.css'
import './assets/index.css'
import router from './router'
import { initializeTheme } from './composables/useTheme'

initializeTheme({ defaultTheme: 'dark', defaultColorTheme: 'classic' })

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
