import { persistentAtom } from '@nanostores/persistent'
import { atom, computed, type WritableAtom } from 'nanostores'

import { computeColorValues } from '../lib/color.js'
import type { Channel, ColorStep, FullColorStep } from '../types'

/** Default color scale - a blue/violet scale */
const DEFAULT_SCALE: ColorStep[] = [
	{ stop: 50, L: 0.9843, C: 0.0074, H: 260.73 },
	{ stop: 100, L: 0.9624, C: 0.0178, H: 261.34 },
	{ stop: 200, L: 0.9017, C: 0.0478, H: 259.1 },
	{ stop: 300, L: 0.814, C: 0.0944, H: 256.05 },
	{ stop: 400, L: 0.759, C: 0.1258, H: 254.28 },
	{ stop: 500, L: 0.6403, C: 0.1965, H: 254.23 },
	{ stop: 600, L: 0.5109, C: 0.1813, H: 257.4 },
	{ stop: 700, L: 0.3841, C: 0.1381, H: 258.43 },
	{ stop: 800, L: 0.2874, C: 0.098, H: 258.78 },
	{ stop: 900, L: 0.2235, C: 0.0695, H: 258.79 },
	{ stop: 950, L: 0.2003, C: 0.0608, H: 258.77 },
]

/** The raw scale data (persisted to localStorage) */
export const $scale: WritableAtom<ColorStep[]> = persistentAtom<ColorStep[]>(
	'prismatia:scale',
	DEFAULT_SCALE,
	{
		encode: JSON.stringify,
		decode: JSON.parse,
	},
)

/** Currently selected swatch index (defaults to 500-level swatch at index 5) */
export const $activeIndex = atom<number | undefined>(5)

/** Selected color gamut for graph constraints (persisted to localStorage) */
export const $gamut = persistentAtom<'srgb' | 'p3'>('prismatia:gamut', 'srgb', {
	encode: JSON.stringify,
	decode: JSON.parse,
})

/** Computed full scale with hex values and contrast ratios */
export const $fullScale = computed(
	$scale,
	(scale) =>
		scale.map((step) => ({
			...step,
			...computeColorValues(step),
		})) as FullColorStep[],
)

/** Currently selected color step (if any) */
export const $activeColor = computed([$scale, $activeIndex], (scale, index) => {
	if (index === undefined) return
	return scale[index] ?? undefined
})

/** Currently selected full color step (if any) */
export const $activeFullColor = computed([$fullScale, $activeIndex], (scale, index) => {
	if (index === undefined) return
	return scale[index] ?? undefined
})

// ─── Actions ────────────────────────────────────────────────────────────────

/** Select a swatch by index */
export function selectSwatch(index?: number): void {
	$activeIndex.set(index)
}

/** Set the color gamut for graph constraints */
export function setGamut(gamut: 'srgb' | 'p3'): void {
	$gamut.set(gamut)
}

/** Update a single color step */
export function updateStep(index: number, updates: Partial<ColorStep>): void {
	let scale = $scale.get()
	if (index < 0 || scale.length <= index) return

	let newScale = [...scale]
	newScale[index] = { ...newScale[index], ...updates }
	$scale.set(newScale)
}

/** Update the active color step */
export function updateActiveStep(updates: Partial<ColorStep>): void {
	let index = $activeIndex.get()
	if (index === undefined) return
	updateStep(index, updates)
}

/** Global nudge - adjust a channel for all steps */
export function globalNudge(channel: Channel, delta: number): void {
	let scale = $scale.get()
	let newScale = scale.map((step) => {
		let newStep = { ...step }

		switch (channel) {
			case 'L':
				newStep.L = Math.max(0, Math.min(1, step.L + delta))
				break
			case 'C':
				newStep.C = Math.max(0, Math.min(0.5, step.C + delta))
				break
			case 'H':
				newStep.H = (((step.H + delta) % 360) + 360) % 360
				break
			default:
		}

		return newStep
	})

	$scale.set(newScale)
}

/** Reset scale to default */
export function resetScale(): void {
	$scale.set(DEFAULT_SCALE.map((s) => ({ ...s })))
	$activeIndex.set(undefined)
}

/** Export scale as JSON */
export function exportAsJSON(): string {
	let scale = $fullScale.get()
	return JSON.stringify(
		scale.map((s) => ({
			stop: s.stop,
			L: Number.parseFloat(s.L.toFixed(4)),
			C: Number.parseFloat(s.C.toFixed(4)),
			H: Number.parseFloat(s.H.toFixed(2)),
			hex: s.hex,
		})),
		undefined,
		2,
	)
}

/** Export scale as CSS custom properties */
export function exportAsCSS(): string {
	let scale = $scale.get()
	let properties = scale
		.map(
			(s) =>
				`  --color-${String(s.stop)}: oklch(${(s.L * 100).toFixed(1)}% ${s.C.toFixed(3)} ${s.H.toFixed(1)});`,
		)
		.join('\n')
	return `:root {\n${properties}\n}`
}
