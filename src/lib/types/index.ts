export interface Account {
	id: string
	name: string
	currentBalance: number
	monthlyContribution: number
	expectedAnnualReturn: number
	contributionGrowthRate?: number
	isLocked: boolean
	taxBenefitRate?: number
	isFund?: boolean
	color: string
}

export interface Plan {
	timeHorizonYears: number
	inflationRate: number
	monthlyIncome: number
	monthlyFixedCosts: number
	freistellungsauftrag: number
}

export interface AppState {
	accounts: Account[]
	plan: Plan
}
