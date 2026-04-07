import { writable, get } from 'svelte/store'
import type { AppState, Account, Plan } from '$lib/types'
import { loadState, saveState, localStorageAvailable } from './persistence'

function defaultState(): AppState {
	return {
		accounts: [],
		plan: {
			timeHorizonYears: 10,
			inflationRate: 0,
			monthlyIncome: 0,
			monthlyFixedCosts: 0,
			freistellungsauftrag: 1000
		}
	}
}

function createAppStore() {
	const initial = (typeof window !== 'undefined' ? loadState() : null) ?? defaultState()
	const store = writable<AppState>(initial)

	store.subscribe((state) => {
		saveState(state)
	})

	return {
		subscribe: store.subscribe,
		set: store.set,
		update: store.update,

		// Accounts
		addAccount(account: Account) {
			store.update((s) => ({ ...s, accounts: [...s.accounts, account] }))
		},
		updateAccount(id: string, changes: Partial<Account>) {
			store.update((s) => ({
				...s,
				accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...changes } : a))
			}))
		},
		deleteAccount(id: string) {
			store.update((s) => ({
				...s,
				accounts: s.accounts.filter((a) => a.id !== id)
			}))
		},

		// Plan
		updatePlan(changes: Partial<Plan>) {
			store.update((s) => ({ ...s, plan: { ...s.plan, ...changes } }))
		},

		// Data management
		importState(state: AppState) {
			store.set(state)
		},
		resetToDefaults() {
			store.set(defaultState())
		},
		getState(): AppState {
			return get(store)
		}
	}
}

export const appStore = createAppStore()
export { localStorageAvailable }
