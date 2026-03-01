import { getBestContrastColor, getContrastLevel } from '../lib/color.js'
import { $activeIndex, selectSwatch } from '../stores/scale.js'
import type { FullColorStep } from '../types'
import { css, html } from './_utilities.js'

const styles = css`
	:host {
		display: contents;
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
		background: none;
		border: none;
		border-radius: 6px;
		transition: transform 0.12s ease-out;

		&::before {
			position: absolute;
			inset: 0;
			z-index: 1;
			content: '';
			background-color: currentcolor;
			border-radius: 6px;
			opacity: 0;
			transition: opacity 150ms ease-in;
		}
	}

	.swatch-background {
		position: absolute;
		inset: 0;
		border-radius: 6px;
		box-shadow: inset 0 0 0 1px color-mix(currentcolor, transparent 80%);
		transform-origin: top center;
		scale: 1 1;
		transition: all 100ms ease-in;
	}

	.swatch.active {
		.swatch-background {
			border-end-end-radius: 12px;
			/* stylelint-disable-next-line property-no-unknown */
			corner-end-end-shape: bevel;
			scale: 1 0.9;
		}
	}

	.swatch:hover {
		z-index: 1;

		&:not(.active)::before {
			opacity: 0.2;
		}
	}

	.swatch:focus-visible {
		z-index: 1;
		outline: 0;

		.swatch-background {
			outline: 2px solid var(--grey-900);
		}
	}

	.swatch:active {
		scale: 0.95;
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
		color: currentcolor;
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
		position: relative;
		font-family: var(--text-family-mono);
		font-size: 12px;
		font-weight: 400;
	}
`

export class SwatchButton extends HTMLElement {
	private shadow: ShadowRoot
	private unsubscribers: Array<() => void> = []
	private index: number = 0
	private step: FullColorStep | undefined

	constructor() {
		super()
		this.shadow = this.attachShadow({ mode: 'open' })
	}

	connectedCallback() {
		// Get attributes
		let indexAttribute = this.dataset.index
		if (indexAttribute !== undefined) {
			this.index = Number.parseInt(indexAttribute, 10)
		}

		// Subscribe to active index changes
		this.unsubscribers.push(
			$activeIndex.subscribe(() => {
				this.updateActiveState()
			}),
		)

		this.render()
	}

	disconnectedCallback() {
		for (let unsub of this.unsubscribers) unsub()
		this.unsubscribers = []
	}

	setData(step: FullColorStep, index: number) {
		this.step = step
		this.index = index
		this.dataset.index = String(index)
		this.render()
	}

	private updateActiveState() {
		if (!this.step) return
		let activeIndex = $activeIndex.get()
		let button = this.shadow.querySelector('.swatch')
		if (button) {
			if (this.index === activeIndex) {
				button.classList.add('active')
				button.setAttribute('aria-pressed', 'true')
			} else {
				button.classList.remove('active')
				button.setAttribute('aria-pressed', 'false')
			}
		}
	}

	private render() {
		if (!this.step) return

		let { color, ratio } = getBestContrastColor(this.step.hex)
		let level = getContrastLevel(ratio)
		let activeIndex = $activeIndex.get()
		let isActive = this.index === activeIndex
		let classes = ['swatch', isActive ? 'active' : '', this.step.isInGamut ? '' : 'out-of-gamut']
			.filter(Boolean)
			.join(' ')

		this.shadow.innerHTML = html`
			<style>
				${styles}
			</style>
			<button
				class="${classes}"
				style="color: ${color}"
				aria-label="Select color ${String(this.step.stop)}"
				aria-pressed="${String(isActive)}"
			>
				<div class="swatch-background" style="background: ${this.step.hex};"></div>
				<!--<span class="contrast-score">${ratio.toFixed(1)}</span>-->
				<span class="contrast-level">${level}</span>
			</button>
		`

		let button = this.shadow.querySelector('.swatch')
		if (button) {
			button.addEventListener('click', () => {
				selectSwatch(this.index)
			})
		}
	}
}

customElements.define('swatch-button', SwatchButton)
