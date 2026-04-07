import type { Account, Plan } from '$lib/types'
import type { WhatIfOverride } from '$lib/stores/whatif.svelte'

export function applyWhatIfOverrides(
	accounts: Account[],
	overrides: Record<string, WhatIfOverride>
): Account[] {
	return accounts.map((acc) => {
		const o = overrides[acc.id]
		if (!o || Object.keys(o).length === 0) return acc
		return { ...acc, ...o }
	})
}

export function projectBalance(
	startBalance: number,
	monthlyContribution: number,
	annualReturn: number,
	months: number,
	annualContributionGrowth = 0
): number[] {
	const monthlyRate = Math.pow(1 + annualReturn, 1 / 12) - 1
	const balances: number[] = new Array(months + 1)
	balances[0] = startBalance
	for (let n = 1; n <= months; n++) {
		const year = Math.floor((n - 1) / 12)
		const contribution = annualContributionGrowth === 0
			? monthlyContribution
			: monthlyContribution * Math.pow(1 + annualContributionGrowth, year)
		balances[n] = balances[n - 1] * (1 + monthlyRate) + contribution
	}
	return balances
}

export function adjustForInflation(nominalValues: number[], annualInflation: number): number[] {
	return nominalValues.map((v, n) => v / Math.pow(1 + annualInflation, n / 12))
}

export function projectAllAccounts(
	accounts: Account[],
	plan: Plan
): Record<string, number[]> {
	const months = plan.timeHorizonYears * 12
	const result: Record<string, number[]> = {}
	for (const account of accounts) {
		result[account.id] = projectBalance(
			account.currentBalance,
			account.monthlyContribution,
			account.expectedAnnualReturn,
			months,
			account.contributionGrowthRate ?? 0
		)
	}
	return result
}

export function totalWealthByMonth(
	projections: Record<string, number[]>,
	accounts: Account[],
	excludeLocked?: boolean
): number[] {
	const lockedIds = new Set(
		accounts.filter((a) => a.isLocked).map((a) => a.id)
	)

	const eligible = Object.entries(projections).filter(
		([id]) => !excludeLocked || !lockedIds.has(id)
	)

	if (eligible.length === 0) return []

	const length = eligible[0][1].length
	const totals = new Array(length).fill(0)
	for (const [, values] of eligible) {
		for (let i = 0; i < length; i++) {
			totals[i] += values[i]
		}
	}
	return totals
}

export function coastFINumber(
	targetAmount: number,
	yearsToRetirement: number,
	annualReturn: number
): number {
	return targetAmount / Math.pow(1 + annualReturn, yearsToRetirement)
}

export function mattressBalance(
	startBalance: number,
	monthlyContribution: number,
	months: number,
	annualContributionGrowth = 0
): number[] {
	if (annualContributionGrowth === 0) {
		return Array.from({ length: months + 1 }, (_, i) => startBalance + monthlyContribution * i)
	}
	const balances = new Array(months + 1)
	balances[0] = startBalance
	for (let n = 1; n <= months; n++) {
		const year = Math.floor((n - 1) / 12)
		balances[n] = balances[n - 1] + monthlyContribution * Math.pow(1 + annualContributionGrowth, year)
	}
	return balances
}

export function totalMattressByMonth(
	accounts: Account[],
	plan: Plan,
	excludeLocked = false
): number[] {
	const months = plan.timeHorizonYears * 12
	const eligible = excludeLocked ? accounts.filter((a) => !a.isLocked) : accounts
	const totals = new Array(months + 1).fill(0)
	for (const acc of eligible) {
		const balances = mattressBalance(acc.currentBalance, acc.monthlyContribution, months, acc.contributionGrowthRate ?? 0)
		for (let i = 0; i <= months; i++) {
			totals[i] += balances[i]
		}
	}
	return totals
}

export function milestoneAchievedAt(
	projection: number[],
	targetAmount: number
): number | null {
	for (let i = 0; i < projection.length; i++) {
		if (projection[i] >= targetAmount) return i
	}
	return null
}

export function monthsToLabel(months: number): string {
	const years = Math.floor(months / 12)
	const remainingMonths = months % 12

	if (years === 0) {
		return remainingMonths === 1 ? '1 Monat' : `${remainingMonths} Monate`
	}
	if (remainingMonths === 0) {
		return years === 1 ? '1 Jahr' : `${years} Jahre`
	}
	const yearPart = years === 1 ? '1 Jahr' : `${years} Jahre`
	const monthPart = remainingMonths === 1 ? '1 Monat' : `${remainingMonths} Monate`
	return `${yearPart} ${monthPart}`
}

// Kapitalertragsteuer: 25% + 5.5% Soli = 26.375%
// Equity funds (isFund=true) get 30% Teilfreistellung → effective rate on gains = 18.4625%
export function kapitalertragsteuer(
	grossValue: number,
	costBasis: number,
	isFund: boolean,
	freistellungsauftrag: number
): number {
	const gains = Math.max(0, grossValue - costBasis)
	const taxableGains = isFund ? gains * 0.7 : gains
	const taxable = Math.max(0, taxableGains - freistellungsauftrag)
	return taxable * 0.26375
}

export function formatEur(amount: number): string {
	return amount.toLocaleString('de-DE', {
		style: 'currency',
		currency: 'EUR',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	})
}

export function formatPercent(decimal: number): string {
	return (decimal * 100).toLocaleString('de-DE', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	}) + ' %'
}
