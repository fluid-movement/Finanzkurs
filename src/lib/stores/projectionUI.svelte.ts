// Shared reactive UI state for projection controls.
// Using a .svelte.ts module lets MarktdatenCard write directly to the same
// $state the ProjectionSection slider binds to — no store-to-local sync needed.

let _inflationRate = $state(0.02)

export const projectionUI = {
	get inflationRate() { return _inflationRate },
	set inflationRate(v: number) { _inflationRate = v },
}
