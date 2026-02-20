import { hexToOklch } from '../lib/color.js'
import { $activeFullColor, $activeIndex, selectSwatch, updateActiveStep } from '../stores/scale.js'
// eslint-disable-next-line import-x/extensions
import { CHANNEL_CONFIGS } from '../types'
import { css, html } from './_utilities.js'

const styles = css`
	:host {
		display: block;
	}

	.editor {
		display: none;
		padding: var(--space-lg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
	}

	.editor.active {
		display: block;
	}

	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-block-end: var(--space-md);
	}

	.editor-title {
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 600;
	}

	.close-btn {
		padding: var(--space-xs);
		font-size: 20px;
		line-height: 1;
		color: var(--text-muted);
		background: none;
		border: none;
		transition: color 0.1s;
	}

	.close-btn:hover {
		color: var(--text);
	}

	.editor-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-md);
	}

	@media (width <= 800px) {
		.editor-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.field label {
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.input-group {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	input[type='range'] {
		flex: 1;
		block-size: 6px;
		cursor: pointer;
		outline: none;
		background: var(--surface-2);
		border-radius: 3px;
	}

	input[type='range']::-webkit-slider-thumb {
		inline-size: 16px;
		block-size: 16px;
		cursor: grab;
		background: var(--accent);
		border-radius: 50%;
		box-shadow: var(--shadow-sm);
		transition: transform 0.1s;
	}

	input[type='range']::-webkit-slider-thumb:hover {
		transform: scale(1.1);
	}

	input[type='range']::-webkit-slider-thumb:active {
		cursor: grabbing;
	}

	input[type='range']::-moz-range-thumb {
		inline-size: 16px;
		block-size: 16px;
		cursor: grab;
		background: var(--accent);
		border: none;
		border-radius: 50%;
		box-shadow: var(--shadow-sm);
	}

	input[type='number'],
	input[type='text'] {
		inline-size: 70px;
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

	input[type='number']::-webkit-outer-spin-button,
	input[type='number']::-webkit-inner-spin-button {
		appearance: none;
	}

	input[type='text'].hex-input {
		inline-size: 90px;
	}

	input:focus {
		border-color: var(--border-focus);
	}

	.gamut-warning {
		display: none;
		grid-column: 1 / -1;
		padding: 10px 12px;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--error);
		background: rgb(255 107 53 / 10%);
		border: 1px solid rgb(255 107 53 / 30%);
		border-radius: var(--radius-md);
	}

	.gamut-warning.show {
		display: block;
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
		)
	}

	disconnectedCallback() {
		for (let unsub of this.unsubscribers) unsub()
		this.unsubscribers = []
	}

	private render() {
		let color = $activeFullColor.get()
		let isActive = $activeIndex.get() !== undefined

		this.shadow.innerHTML = html`
			<style>
				${styles}
			</style>
			<div class="editor ${isActive ? 'active' : ''}">
				${color ? this.renderEditor(color) : ''}
			</div>
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

		// Update L/C/H inputs (skip if focused)
		for (let channel of ['L', 'C', 'H'] as const) {
			let rangeInput = shadow.querySelector<HTMLInputElement>(`#range-${channel}`)
			let numberInput = shadow.querySelector<HTMLInputElement>(`#num-${channel}`)
			let value = color[channel]

			if (rangeInput && rangeInput !== activeElement) {
				rangeInput.value = String(value)
			}

			if (numberInput && numberInput !== activeElement) {
				numberInput.value = value.toFixed(channel === 'H' ? 1 : 3)
			}
		}

		// Update hex input (skip if focused)
		let hexInput = shadow.querySelector<HTMLInputElement>('#hex-input')
		if (hexInput && hexInput !== activeElement) {
			hexInput.value = color.hex
		}
	}

	private renderEditor(color: NonNullable<ReturnType<typeof $activeFullColor.get>>): string {
		let { L, C, H } = CHANNEL_CONFIGS

		return html`
			<div class="editor-header">
				<span class="editor-title">Edit ${String(color.stop)}</span>
				<button class="close-btn" aria-label="Close editor">
					&times;
				</button>
			</div>
			<div class="editor-grid">
				<div class="field">
					<label>Lightness (L)</label>
					<div class="input-group">
						<input
							type="range"
							id="range-L"
							min="${String(L.min)}"
							max="${String(L.max)}"
							step="${String(L.step)}"
							value="${String(color.L)}"
						/>
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
						<input
							type="range"
							id="range-C"
							min="${String(C.min)}"
							max="${String(C.max)}"
							step="${String(C.step)}"
							value="${String(color.C)}"
						/>
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
						<input
							type="range"
							id="range-H"
							min="${String(H.min)}"
							max="${String(H.max)}"
							step="${String(H.step)}"
							value="${String(color.H)}"
						/>
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
				<div class="field">
					<label>Hex</label>
					<input
						type="text"
						id="hex-input"
						class="hex-input"
						value="${color.hex}"
						placeholder="#000000"
					/>
				</div>
			</div>
		`
	}

	private attachListeners() {
		let { shadow } = this

		// Close button
		shadow.querySelector('.close-btn')?.addEventListener('click', () => {
			selectSwatch()
		})

		// Range inputs
		for (let channel of ['L', 'C', 'H']) {
			let rangeInput = shadow.querySelector<HTMLInputElement>(`#range-${channel}`)
			let numberInput = shadow.querySelector<HTMLInputElement>(`#num-${channel}`)

			if (!rangeInput || !numberInput) continue

			rangeInput.addEventListener('input', () => {
				let value = Number.parseFloat(rangeInput.value)
				numberInput.value = value.toFixed(channel === 'H' ? 1 : 3)
				updateActiveStep({ [channel]: value })
			})

			numberInput.addEventListener('input', () => {
				let value = Number.parseFloat(numberInput.value)
				if (!Number.isNaN(value)) {
					rangeInput.value = String(value)
					updateActiveStep({ [channel]: value })
				}
			})
		}

		// Hex input
		let hexInput = shadow.querySelector<HTMLInputElement>('#hex-input')
		hexInput?.addEventListener('change', () => {
			let hex = hexInput.value.trim()
			if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
				let oklch = hexToOklch(hex)
				updateActiveStep(oklch)
			}
		})
	}
}

customElements.define('swatch-editor', SwatchEditor)
