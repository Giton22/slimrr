const SETUP_COACH_STORAGE_KEY = 'slimrr:setup-coach-welcome'

export function markSetupCoachWelcomePending() {
  sessionStorage.setItem(SETUP_COACH_STORAGE_KEY, '1')
}

export function hasSetupCoachWelcomePending() {
  return sessionStorage.getItem(SETUP_COACH_STORAGE_KEY) === '1'
}

export function clearSetupCoachWelcomePending() {
  sessionStorage.removeItem(SETUP_COACH_STORAGE_KEY)
}
