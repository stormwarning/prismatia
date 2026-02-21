/* eslint-disable yoda */
import Color from 'colorjs.io'

import type { ColorStep, ComputedColor } from '../types'

/** A range of valid values [min, max] */
export type ValueRange = [number, number]

/**
 * Convert OKLCH values to an sRGB hex string.
 * Uses gamut mapping to ensure the color is displayable.
 */
export function oklchToHex(L: number, C: number, H: number): string {
	let color = new Color('oklch', [L, C, H])
	let srgb = color.to('srgb').toGamut({ space: 'srgb' })
	return srgb.toString({ format: 'hex' })
}

/**
 * Convert a hex string to OKLCH values.
 */
export function hexToOklch(hex: string): { C: number; H: number; L: number } {
	let color = new Color(hex)
	let oklch = color.to('oklch')
	return {
		L: oklch.coords[0] ?? 0,
		C: oklch.coords[1] ?? 0, // Chroma can be NaN for grays
		H: oklch.coords[2] ?? 0, // Hue can be NaN for achromatic
	}
}

/**
 * Check if an OKLCH color is within sRGB gamut.
 */
export function isInSrgbGamut(L: number, C: number, H: number): boolean {
	let color = new Color('oklch', [L, C, H])
	return color.inGamut('srgb')
}

/**
 * Check if an OKLCH color is within P3 gamut.
 */
export function isInP3Gamut(L: number, C: number, H: number): boolean {
	let color = new Color('oklch', [L, C, H])
	return color.inGamut('p3')
}

/**
 * Get the maximum chroma for a given lightness and hue within sRGB gamut.
 * Uses binary search for precision.
 */
export function getMaxChromaForLH(L: number, H: number, space: 'srgb' | 'p3' = 'srgb'): number {
	let low = 0
	let high = 0.5
	let tolerance = 0.001

	while (tolerance < high - low) {
		let mid = (low + high) / 2
		let color = new Color('oklch', [L, mid, H])
		if (color.inGamut(space)) {
			low = mid
		} else {
			high = mid
		}
	}

	return low
}

/**
 * Calculate WCAG 2.1 contrast ratio between two colors.
 */
export function getContrastRatio(hex1: string, hex2: string): number {
	let color1 = new Color(hex1)
	let color2 = new Color(hex2)
	return Math.abs(color1.contrast(color2, 'WCAG21'))
}

/**
 * Determine WCAG contrast level.
 */
export function getContrastLevel(ratio: number): 'AAA' | 'AA' | 'X' {
	if (7 <= ratio) return 'AAA'
	if (4.5 <= ratio) return 'AA'
	return 'X'
}

/**
 * Choose the best contrast color (black or white) for text on a given background.
 */
export function getBestContrastColor(bgHex: string): {
	color: string
	ratio: number
} {
	let contrastWhite = getContrastRatio(bgHex, '#ffffff')
	let contrastBlack = getContrastRatio(bgHex, '#000000')

	return contrastBlack < contrastWhite
		? { color: '#ffffff', ratio: contrastWhite }
		: { color: '#000000', ratio: contrastBlack }
}

/**
 * Compute all derived color values from a color step.
 */
export function computeColorValues(step: ColorStep): ComputedColor {
	let hex = oklchToHex(step.L, step.C, step.H)
	let isInGamut = isInSrgbGamut(step.L, step.C, step.H)
	let contrastOnWhite = getContrastRatio(hex, '#ffffff')
	let contrastOnBlack = getContrastRatio(hex, '#000000')

	return {
		hex,
		isInGamut,
		contrastOnWhite,
		contrastOnBlack,
	}
}

/**
 * Create an oklch() CSS string.
 */
export function toOklchString(L: number, C: number, H: number): string {
	return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`
}

/**
 * Get valid lightness ranges for a given chroma and hue.
 * Returns an array of [min, max] ranges that are in gamut.
 */
export function getValidLightnessRanges(
	C: number,
	H: number,
	space: 'srgb' | 'p3' = 'srgb',
	samples = 100,
): ValueRange[] {
	let ranges: ValueRange[] = []
	let rangeStart: number | undefined

	for (let index = 0; index <= samples; index++) {
		let L = index / samples
		let isInGamut = new Color('oklch', [L, C, H]).inGamut(space)

		if (isInGamut && rangeStart === undefined) {
			rangeStart = L
		} else if (!isInGamut && rangeStart !== undefined) {
			ranges.push([rangeStart, (index - 1) / samples])
			rangeStart = undefined
		}
	}

	if (rangeStart !== undefined) {
		ranges.push([rangeStart, 1])
	}

	return ranges
}

/**
 * Get valid chroma ranges for a given lightness and hue.
 * Returns an array of [min, max] ranges that are in gamut.
 * For most cases this is just [0, maxChroma].
 */
export function getValidChromaRanges(
	L: number,
	H: number,
	space: 'srgb' | 'p3' = 'srgb',
	maxChroma = 0.4,
): ValueRange[] {
	// Chroma always starts valid at 0 (grey) and becomes invalid above some max
	let max = getMaxChromaForLH(L, H, space)
	if (max <= 0) return []
	return [[0, Math.min(max, maxChroma)]]
}

/**
 * Get valid hue ranges for a given lightness and chroma.
 * Returns an array of [min, max] ranges that are in gamut.
 * Hue wraps around 360°, so ranges may span the boundary.
 */
export function getValidHueRanges(
	L: number,
	C: number,
	space: 'srgb' | 'p3' = 'srgb',
	samples = 72,
): ValueRange[] {
	if (C === 0) {
		// Achromatic - all hues are valid (they're all the same grey)
		return [[0, 360]]
	}

	let ranges: ValueRange[] = []
	let rangeStart: number | undefined
	let step = 360 / samples

	// Sample i=0..samples-1 so H goes 0..355 without duplicating H=0 at i=samples
	for (let index = 0; index < samples; index++) {
		let H = index * step
		let isInGamut = new Color('oklch', [L, C, H]).inGamut(space)

		if (isInGamut && rangeStart === undefined) {
			rangeStart = H
		} else if (!isInGamut && rangeStart !== undefined) {
			ranges.push([rangeStart, (index - 1) * step])
			rangeStart = undefined
		}
	}

	// Close any open range at 360. Keep it as a separate range rather than
	// merging with a [0, x] range — invertRanges handles two split ranges
	// (e.g. [0,60] and [300,360]) correctly, producing [60,300] as invalid.
	if (rangeStart !== undefined) {
		ranges.push([rangeStart, 360])
	}

	return ranges
}

/**
 * Get valid ranges for a specific channel given the other two channel values.
 */
export function getValidRangesForChannel(
	channel: 'L' | 'C' | 'H',
	step: ColorStep,
	space: 'srgb' | 'p3' = 'srgb',
): ValueRange[] {
	if (channel === 'L') return getValidLightnessRanges(step.C, step.H, space)
	if (channel === 'C') return getValidChromaRanges(step.L, step.H, space)
	return getValidHueRanges(step.L, step.C, space)
}

/**
 * Snaps a value to the nearest boundary within the union of valid ranges.
 * If the value already falls within a valid range, it is returned unchanged.
 * If validRanges is empty, the value is returned unchanged.
 */
export function clampToValidRanges(value: number, validRanges: ValueRange[]): number {
	if (validRanges.length === 0) return value

	for (let [start, end] of validRanges) {
		if (start <= value && value <= end) return value
	}

	let nearest = validRanges[0][0]
	let nearestDistance = Math.abs(value - nearest)

	for (let [start, end] of validRanges) {
		for (let boundary of [start, end]) {
			let distance = Math.abs(value - boundary)
			if (distance < nearestDistance) {
				nearestDistance = distance
				nearest = boundary
			}
		}
	}

	return nearest
}
