import { persistentAtom } from '@nanostores/persistent'
import { atom, computed, type WritableAtom } from 'nanostores'

import { clampToValidRanges, computeColorValues, getValidRangesForChannel } from '../lib/color.js'
import type { Channel, ColorMode, ColorStep, FullColorStep } from '../types'

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
// const DEFAULT_SCALE: ColorStep[] = [
// 	{ stop: 50, L: 0, C: 0, H: 290 },
// 	{ stop: 100, L: 0.2175, C: 0.0517, H: 289.92 },
// 	{ stop: 200, L: 0.3405, C: 0.0527, H: 229.81 },
// 	{ stop: 300, L: 0.4562, C: 0.0918, H: 157.2 },
// 	{ stop: 400, L: 0.5312, C: 0.1113, H: 131.53 },
// 	{ stop: 500, L: 0.6038, C: 0.081, H: 71.04 },
// 	{ stop: 600, L: 0.686, C: 0.1043, H: 3.64 },
// 	{ stop: 700, L: 0.7612, C: 0.1029, H: 320.31 },
// 	{ stop: 800, L: 0.8456, C: 0.0581, H: 275.37 },
// 	{ stop: 900, L: 0.9291, C: 0.0294, H: 199.28 },
// 	{ stop: 950, L: 1, C: 0, H: 200 },
// ]

/** All scales (persisted to localStorage) */
export const $scales: WritableAtom<ColorStep[][]> = persistentAtom<ColorStep[][]>(
	'prismatia:scales',
	[DEFAULT_SCALE.map((s) => ({ ...s }))],
	{
		encode: JSON.stringify,
		decode: JSON.parse,
	},
)

/** Scale names (persisted to localStorage) */
export const $scaleNames: WritableAtom<string[]> = persistentAtom<string[]>(
	'prismatia:scaleNames',
	['scale-0'],
	{
		encode: JSON.stringify,
		decode: JSON.parse,
	},
)

/** Convert a string to kebab-case */
function toKebabCase(string_: string): string {
	return string_
		.trim()
		.toLowerCase()
		.replaceAll(/[\s_]+/g, '-')
		.replaceAll(/[^a-z0-9-]/g, '')
		.replaceAll(/-+/g, '-')
		.replaceAll(/^-|-$/g, '')
}

/** Get the kebab-case name for a scale by index, with fallback */
export function getScaleName(index: number): string {
	let names = $scaleNames.get()
	let name = names[index]
	return name ? toKebabCase(name) : `scale-${String(index)}`
}

/** Currently active scale index */
export const $activeScaleIndex = atom<number>(0)

/** The active scale (derived from $scales and $activeScaleIndex) */
export const $scale = computed([$scales, $activeScaleIndex], (scales, index) => scales[index] ?? [])

/** Currently selected swatch index (defaults to 500-level swatch at index 5) */
export const $activeIndex = atom<number | undefined>(5)

/** Selected color gamut for graph constraints (persisted to localStorage) */
export const $gamut = persistentAtom<'srgb' | 'p3'>('prismatia:gamut', 'srgb', {
	encode: JSON.stringify,
	decode: JSON.parse,
})

/** Selected color display mode for CSS string input (persisted to localStorage) */
export const $colorMode = persistentAtom<ColorMode>('prismatia:color-mode', 'hex', {
	encode: JSON.stringify,
	decode: JSON.parse,
})

/** Computed full scales with hex values and contrast ratios */
export const $fullScales = computed($scales, (scales) =>
	scales.map(
		(scale) =>
			scale.map((step) => ({
				...step,
				...computeColorValues(step),
			})) as FullColorStep[],
	),
)

/** Computed full active scale (for backward compatibility) */
export const $fullScale = computed(
	[$fullScales, $activeScaleIndex],
	(fullScales, index) => fullScales[index] ?? [],
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

// ─── Internal helpers ────────────────────────────────────────────────────────

function setActiveScale(newScale: ColorStep[]): void {
	let scales = [...$scales.get()]
	let index = $activeScaleIndex.get()
	scales[index] = newScale
	$scales.set(scales)
}

// ─── Actions ────────────────────────────────────────────────────────────────

/** Select a swatch by index, and optionally switch the active scale */
export function selectSwatch(index?: number, scaleIndex?: number): void {
	if (scaleIndex !== undefined) $activeScaleIndex.set(scaleIndex)
	$activeIndex.set(index)
}

/** Set the color gamut for graph constraints */
export function setGamut(gamut: 'srgb' | 'p3'): void {
	$gamut.set(gamut)
}

/** Set the color display mode */
export function setColorMode(mode: ColorMode): void {
	$colorMode.set(mode)
}

/** Update a single color step in the active scale */
export function updateStep(index: number, updates: Partial<ColorStep>): void {
	let scale = $scale.get()
	if (index < 0 || scale.length <= index) return

	let newScale = [...scale]
	newScale[index] = { ...newScale[index], ...updates }
	setActiveScale(newScale)
}

/** Update the active color step */
export function updateActiveStep(updates: Partial<ColorStep>): void {
	let index = $activeIndex.get()
	if (index === undefined) return
	updateStep(index, updates)
}

/** Global nudge - adjust a channel for all steps in the active scale, clamped to gamut */
export function globalNudge(channel: Channel, delta: number): void {
	let scale = $scale.get()
	let gamut = $gamut.get()
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

		let validRanges = getValidRangesForChannel(channel, newStep, gamut)
		newStep[channel] = clampToValidRanges(newStep[channel], validRanges)

		return newStep
	})

	setActiveScale(newScale)
}

/** Add a new scale derived from the last scale, with hue shifted by -45°, clamped to gamut */
export function addScale(): void {
	let scales = $scales.get()
	let lastScale = scales.at(-1) ?? []
	let gamut = $gamut.get()
	let newScale: ColorStep[] = lastScale.map((step) => {
		let newH = (((step.H - 60) % 360) + 360) % 360
		let newStep = { ...step, H: newH }
		let validC = getValidRangesForChannel('C', newStep, gamut)
		newStep.C = clampToValidRanges(step.C, validC)
		return newStep
	})
	$scales.set([...scales, newScale])
	$scaleNames.set([...$scaleNames.get(), `scale-${String(scales.length)}`])
	$activeScaleIndex.set(scales.length)
	$activeIndex.set(undefined)
}

/** Reset all scales to default */
export function resetScale(): void {
	$scales.set([DEFAULT_SCALE.map((s) => ({ ...s }))])
	$scaleNames.set(['scale-0'])
	$activeScaleIndex.set(0)
	$activeIndex.set(undefined)
}

/** Export all scales as Design Tokens JSON */
export function exportAsDesignTokensJSON(): string {
	let fullScales = $fullScales.get()
	let color: Record<string, unknown> = {}

	for (let [index, scale] of fullScales.entries()) {
		let name = getScaleName(index)
		let tokens: Record<string, unknown> = {}

		for (let s of scale) {
			tokens[String(s.stop)] = {
				$type: 'color',
				$value: {
					colorSpace: 'oklch',
					components: [
						Number.parseFloat(s.L.toFixed(4)),
						Number.parseFloat(s.C.toFixed(4)),
						Number.parseFloat(s.H.toFixed(2)),
					],
					hex: s.hex,
				},
			}
		}

		color[name] = tokens
	}

	return JSON.stringify({ color }, undefined, 2)
}

/** Export all scales as CSS custom properties */
export function exportAsCSS(): string {
	let scales = $scales.get()
	let properties = scales
		.flatMap((scale, index) => {
			let name = getScaleName(index)
			return scale.map(
				(s) =>
					`  --color-${name}-${String(s.stop)}: oklch(${(s.L * 100).toFixed(1)}% ${s.C.toFixed(3)} ${s.H.toFixed(1)});`,
			)
		})
		.join('\n')

	return `:root {\n${properties}\n}`
}
