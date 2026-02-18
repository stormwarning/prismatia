/** A single step in the color scale */
export interface ColorStep {
	C: number
	H: number
	L: number
	stop: number
}

/** Computed color data derived from ColorStep */
export interface ComputedColor {
	contrastOnBlack: number
	contrastOnWhite: number
	hex: string
	isInGamut: boolean
}

/** Full color step with computed values */
export interface FullColorStep extends ColorStep, ComputedColor {}

/** Channel type for OKLCH */
export type Channel = 'L' | 'C' | 'H'

/** Channel configuration for graphs */
export interface ChannelConfig {
	color: string
	format: (value: number) => string
	label: string
	max: number
	min: number
	step: number
}

export const CHANNEL_CONFIGS: Record<Channel, ChannelConfig> = {
	L: {
		label: 'Lightness',
		min: 0,
		max: 1,
		step: 0.001,
		color: '#4da6ff',
		format: (v) => `${(v * 100).toFixed(0)}%`,
	},
	C: {
		label: 'Chroma',
		min: 0,
		max: 0.4,
		step: 0.001,
		color: '#a06fff',
		format: (v) => v.toFixed(3),
	},
	H: {
		label: 'Hue',
		min: 0,
		max: 360,
		step: 0.5,
		color: '#6fcf97',
		format: (v) => `${v.toFixed(0)}°`,
	},
}
