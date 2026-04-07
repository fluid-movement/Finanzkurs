import type { AppState } from '$lib/types'

const STORAGE_KEY = 'finanzplaner_v1'

export let localStorageAvailable = true

function checkLocalStorage(): boolean {
	try {
		localStorage.setItem('__test__', '1')
		localStorage.removeItem('__test__')
		return true
	} catch {
		return false
	}
}

export function loadState(): AppState | null {
	if (typeof window === 'undefined') return null
	localStorageAvailable = checkLocalStorage()
	if (!localStorageAvailable) return null
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return null
		return JSON.parse(raw) as AppState
	} catch {
		return null
	}
}

export function saveState(state: AppState): void {
	if (typeof window === 'undefined') return
	if (!localStorageAvailable) return
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
	} catch {
		// storage full or unavailable
	}
}

export function clearState(): void {
	if (typeof window === 'undefined') return
	try {
		localStorage.removeItem(STORAGE_KEY)
	} catch {
		// ignore
	}
}
