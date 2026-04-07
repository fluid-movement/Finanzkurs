export type WhatIfOverride = {
	currentBalance?: number
	monthlyContribution?: number
	expectedAnnualReturn?: number
	contributionGrowthRate?: number
}

let _overrides = $state<Record<string, WhatIfOverride>>({})

export const whatIfStore = {
	get overrides() {
		return _overrides
	},

	setField(accountId: string, field: keyof WhatIfOverride, value: number | undefined) {
		const current = { ..._overrides[accountId] }
		if (value === undefined) {
			delete current[field]
		} else {
			current[field] = value
		}
		if (Object.keys(current).length === 0) {
			const next = { ..._overrides }
			delete next[accountId]
			_overrides = next
		} else {
			_overrides = { ..._overrides, [accountId]: current }
		}
	},

	clearAccount(accountId: string) {
		const next = { ..._overrides }
		delete next[accountId]
		_overrides = next
	},

	clearAll() {
		_overrides = {}
	},

	hasOverride(accountId: string): boolean {
		const o = _overrides[accountId]
		return !!o && Object.keys(o).length > 0
	},

	get activeCount(): number {
		return Object.values(_overrides).filter((o) => o && Object.keys(o).length > 0).length
	}
}
