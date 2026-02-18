/// <reference types="vite/client" />

// colorjs.io type declarations (minimal)
// eslint-disable-next-line unicorn/prevent-abbreviations
declare module 'colorjs.io' {
	export default class Color {
		constructor(color: string | [string, number[]])
		constructor(space: string, coords: number[])

		coords: [number, number, number]

		to(space: string): Color
		toGamut(options: { space: string }): Color
		inGamut(space?: string): boolean
		contrast(color: Color, algorithm: string): number
		toString(options?: { format?: string }): string

		static get(color: string, property: string): number
	}
}
