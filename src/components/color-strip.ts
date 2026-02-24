import { getBestContrastColor, getContrastLevel } from '../lib/color.js'
import { $activeIndex, $fullScale, selectSwatch } from '../stores/scale.js'
import type { FullColorStep } from '../types'
import { css, html } from './_utilities.js'

const styles = css`
	:host {
		display: block;
	}

	.strip-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.labels {
		display: flex;
		padding: 0 2px;
	}

	.label {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		text-align: center;
		letter-spacing: 0.02em;
	}

	.strip {
		display: flex;
		gap: 1px;
		block-size: 40px;
		overflow: hidden;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
	}

	.swatch {
		position: relative;
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		align-items: center;
		justify-content: center;
		padding: 0;
		cursor: pointer;
		background: none;
		border: none;
		border-radius: 6px;
		transition: transform 0.12s ease-out;
	}

	.swatch:hover {
		z-index: 1;
	}

	.swatch:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.swatch.out-of-gamut::after {
		position: absolute;
		inset-block-start: 4px;
		inset-inline-end: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		inline-size: 14px;
		block-size: 14px;
		font-size: 9px;
		font-weight: 700;
		color: #fff;
		content: '!';
		background: var(--error);
		border-radius: 50%;
	}

	.contrast-score {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.contrast-level {
		font-family: var(--text-family-mono);
		font-size: 12px;
		font-weight: 400;
	}
`

export class ColorStrip extends HTMLElement {
	private shadow: ShadowRoot
	private unsubscribers: Array<() => void> = []

	constructor() {
		super()
		this.shadow = this.attachShadow({ mode: 'open' })
	}

	connectedCallback() {
		this.render()

		// Subscribe to store changes
		this.unsubscribers.push(
			$fullScale.subscribe(() => {
				this.render()
			}),
			$activeIndex.subscribe(() => {
				this.render()
			}),
		)
	}

	disconnectedCallback() {
		for (let unsub of this.unsubscribers) unsub()
		this.unsubscribers = []
	}

	private render() {
		let scale = $fullScale.get()
		let activeIndex = $activeIndex.get()

		this.shadow.innerHTML = html`
			<style>
				${styles}
			</style>
			<div class="strip-container">
				<div class="labels">
					${scale.map((step) => `<span class="label">${String(step.stop)}</span>`).join('')}
				</div>
				<div class="strip">
					${scale
						.map((step, index) => this.renderSwatch(step, index, index === activeIndex))
						.join('')}
				</div>
			</div>
		`

		// Add click handlers
		for (let [index, element] of this.shadow.querySelectorAll('.swatch').entries()) {
			element.addEventListener('click', () => {
				selectSwatch(index)
			})
		}
	}

	private renderSwatch(step: FullColorStep, index: number, active: boolean): string {
		let { color, ratio } = getBestContrastColor(step.hex)
		let level = getContrastLevel(ratio)
		let classes = ['swatch', active ? 'active' : '', step.isInGamut ? '' : 'out-of-gamut']
			.filter(Boolean)
			.join(' ')

		return html`
			<button
				class="${classes}"
				style="background: ${step.hex}; color: ${color}"
				data-index="${String(index)}"
				aria-label="Select color ${String(step.stop)}"
				aria-pressed="${String(active)}"
			>
				<!--<span class="contrast-score">${ratio.toFixed(1)}</span>-->
				<span class="contrast-level">${level}</span>
			</button>
		`
	}
}

customElements.define('color-strip', ColorStrip)
