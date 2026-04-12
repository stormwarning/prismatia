import {
	clampToValidRanges,
	getValidRangesForChannel,
	parseColorString,
	toColorString,
} from '../lib/color.js'
import {
	$activeFullColor,
	$activeIndex,
	$colorMode,
	$gamut,
	setColorMode,
	updateActiveStep,
} from '../stores/scale.js'
// eslint-disable-next-line import-x/extensions
import { CHANNEL_CONFIGS, type ColorMode } from '../types'
import { css, html } from './_utilities.js'

const styles = css`
	:host {
		display: block;
	}

	.editor {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
	}

	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-block-end: var(--space-md);
	}

	.editor-title {
		font-family: var(--text-family-mono);
		font-size: 14px;
		font-weight: 600;
	}

	.editor-grid {
		display: grid;
		gap: var(--space-md);
	}

	/* @media (width <= 800px) {
		.editor-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	} */

	.field {
		display: grid;
		gap: var(--space-sm);
	}

	.field label {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.input-group {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	channel-slider {
		flex: 1;
	}

	input[type='number'],
	input[type='text'] {
		padding: 6px 8px;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text);
		appearance: textfield;
		outline: none;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
	}

	input[type='number'] {
		inline-size: 5ch;
	}

	input[type='number']::-webkit-outer-spin-button,
	input[type='number']::-webkit-inner-spin-button {
		appearance: none;
	}

	input[type='text'].color-string-input {
		field-sizing: content;
		inline-size: auto;
		min-inline-size: 7ch;
		max-inline-size: 26ch;
	}

	.color-input-group {
		display: flex;
		gap: var(--space-xs);
		align-items: center;
		border: 1px solid var(--ui-border);
	}

	input:focus {
		border-color: var(--border-focus);
	}
`

export class SwatchEditor extends HTMLElement {
	private shadow: ShadowRoot
	private unsubscribers: Array<() => void> = []
	private lastActiveIndex?: number

	constructor() {
		super()
		this.shadow = this.attachShadow({ mode: 'open' })
	}

	connectedCallback() {
		this.render()

		// Only re-render when the active INDEX changes (different swatch selected)
		this.unsubscribers.push(
			$activeIndex.subscribe((index) => {
				if (index !== this.lastActiveIndex) {
					this.lastActiveIndex = index
					this.render()
				}
			}),
			// Update values in-place when color changes (don't re-render)
			$activeFullColor.subscribe((color) => {
				if (color && this.lastActiveIndex !== undefined) {
					this.updateValues(color)
				}
			}),
			// Update color string when mode changes
			$colorMode.subscribe(() => {
				let color = $activeFullColor.get()
				if (color && this.lastActiveIndex !== undefined) {
					let colorStringInput = this.shadow.querySelector<HTMLInputElement>('#color-string-input')
					if (colorStringInput && colorStringInput !== this.shadow.activeElement) {
						colorStringInput.value = toColorString(color.L, color.C, color.H, $colorMode.get())
					}
				}
			}),
		)
	}

	disconnectedCallback() {
		for (let unsub of this.unsubscribers) unsub()
		this.unsubscribers = []
	}

	private render() {
		let color = $activeFullColor.get()

		this.shadow.innerHTML = html`
			<style>
				${styles}
			</style>
			<div class="editor">${color ? this.renderEditor(color) : ''}</div>
		`

		if (color) {
			this.attachListeners()
		}
	}

	/**
	 * Update input values in-place without re-rendering.
	 * Skip updating inputs that currently have focus to avoid interrupting user input.
	 */
	private updateValues(color: NonNullable<ReturnType<typeof $activeFullColor.get>>) {
		let { shadow } = this
		let { activeElement } = shadow

		// Update title
		let title = shadow.querySelector('.editor-title')
		if (title) {
			title.textContent = `Edit ${String(color.stop)}`
		}

		// Update L/C/H number inputs (skip if focused)
		for (let channel of ['L', 'C', 'H'] as const) {
			let numberInput = shadow.querySelector<HTMLInputElement>(`#num-${channel}`)
			let value = color[channel]

			if (numberInput && numberInput !== activeElement) {
				numberInput.value = value.toFixed(channel === 'H' ? 1 : 3)
			}
		}

		// Update color string input (skip if focused)
		let colorStringInput = shadow.querySelector<HTMLInputElement>('#color-string-input')
		if (colorStringInput && colorStringInput !== activeElement) {
			colorStringInput.value = toColorString(color.L, color.C, color.H, $colorMode.get())
		}
	}

	private renderEditor(color: NonNullable<ReturnType<typeof $activeFullColor.get>>): string {
		let { L, C, H } = CHANNEL_CONFIGS
		let mode = $colorMode.get()
		let colorString = toColorString(color.L, color.C, color.H, mode)

		return html`
			<div class="editor-header">
				<span class="editor-title">Edit ${String(color.stop)}</span>
				<div class="color-input-group">
					<f-select id="color-mode-select" value="${mode}">
						<option value="hex">Hex</option>
						<option value="rgb">RGB</option>
						<option value="lch">LCH</option>
						<option value="oklch">OKLCH</option>
					</f-select>
					<input
						type="text"
						id="color-string-input"
						class="color-string-input"
						value="${colorString}"
					/>
				</div>
			</div>
			<div class="editor-grid">
				<div class="field">
					<label>Lightness (L)</label>
					<div class="input-group">
						<channel-slider channel="L"></channel-slider>
						<input
							type="number"
							id="num-L"
							min="${String(L.min)}"
							max="${String(L.max)}"
							step="0.01"
							value="${color.L.toFixed(3)}"
						/>
					</div>
				</div>
				<div class="field">
					<label>Chroma (C)</label>
					<div class="input-group">
						<channel-slider channel="C"></channel-slider>
						<input
							type="number"
							id="num-C"
							min="${String(C.min)}"
							max="${String(C.max)}"
							step="0.01"
							value="${color.C.toFixed(3)}"
						/>
					</div>
				</div>
				<div class="field">
					<label>Hue (H)</label>
					<div class="input-group">
						<channel-slider channel="H"></channel-slider>
						<input
							type="number"
							id="num-H"
							min="${String(H.min)}"
							max="${String(H.max)}"
							step="1"
							value="${color.H.toFixed(1)}"
						/>
					</div>
				</div>
			</div>
		`
	}

	private attachListeners() {
		let { shadow } = this

		// Number inputs
		for (let channel of ['L', 'C', 'H'] as const) {
			let numberInput = shadow.querySelector<HTMLInputElement>(`#num-${channel}`)
			if (!numberInput) continue

			numberInput.addEventListener('input', () => {
				let value = Number.parseFloat(numberInput.value)
				if (!Number.isNaN(value)) {
					updateActiveStep({ [channel]: value })
				}
			})

			numberInput.addEventListener('blur', () => {
				let parsed = Number.parseFloat(numberInput.value)
				let currentColor = $activeFullColor.get()
				if (!currentColor) return

				if (Number.isNaN(parsed)) {
					numberInput.value = currentColor[channel].toFixed(channel === 'H' ? 1 : 3)
					return
				}

				let validRanges = getValidRangesForChannel(channel, currentColor, $gamut.get())
				let clamped = clampToValidRanges(parsed, validRanges)
				if (clamped !== parsed) {
					updateActiveStep({ [channel]: clamped })
					numberInput.value = clamped.toFixed(channel === 'H' ? 1 : 3)
				}
			})
		}

		// Color mode select
		let modeSelect = shadow.querySelector<HTMLElement>('#color-mode-select')
		modeSelect?.addEventListener('change', () => {
			let newMode = (modeSelect as unknown as { value: string }).value as ColorMode
			setColorMode(newMode)
			let currentColor = $activeFullColor.get()
			let colorStringInput = shadow.querySelector<HTMLInputElement>('#color-string-input')
			if (currentColor && colorStringInput) {
				colorStringInput.value = toColorString(
					currentColor.L,
					currentColor.C,
					currentColor.H,
					newMode,
				)
			}
		})

		// Color string input
		let colorStringInput = shadow.querySelector<HTMLInputElement>('#color-string-input')
		colorStringInput?.addEventListener('change', () => {
			let input = colorStringInput.value.trim()
			let parsed = parseColorString(input)
			if (parsed) {
				updateActiveStep(parsed)
			} else {
				// Reset to current color on invalid input
				let currentColor = $activeFullColor.get()
				if (currentColor) {
					colorStringInput.value = toColorString(
						currentColor.L,
						currentColor.C,
						currentColor.H,
						$colorMode.get(),
					)
				}
			}
		})
	}
}

customElements.define('swatch-editor', SwatchEditor)
