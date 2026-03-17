import './swatch-button.js'

import { $activeScaleIndex, $fullScales, addScale } from '../stores/scale.js'
import { css, html } from './_utilities.js'

const styles = css`
	:host {
		display: block;
	}

	.strips {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.strip-row {
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
		outline: 2px solid transparent;
		outline-offset: 2px;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		transition: outline-color 100ms ease;
	}

	.strip.active {
		outline-color: var(--grey-600);
	}

	.add-scale-btn {
		display: flex;
		gap: var(--space-xs);
		align-items: center;
		justify-content: center;
		padding: var(--space-xs) var(--space-sm);
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		background: none;
		border: 1px dashed var(--grey-300);
		border-radius: var(--radius-md);
		transition:
			color 150ms ease,
			border-color 150ms ease;

		&:hover {
			color: var(--text-default);
			border-color: var(--grey-600);
		}
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

		this.unsubscribers.push(
			$fullScales.subscribe(() => {
				this.render()
			}),
			$activeScaleIndex.subscribe(() => {
				this.updateActiveStrip()
			}),
		)
	}

	disconnectedCallback() {
		for (let unsub of this.unsubscribers) unsub()
		this.unsubscribers = []
	}

	private render() {
		let fullScales = $fullScales.get()
		let activeScaleIndex = $activeScaleIndex.get()

		this.shadow.innerHTML = html`
			<style>
				${styles}
			</style>
			<div class="strips">
				${fullScales
					.map(
						(scale, scaleIndex) => html`
							<div class="strip-row">
								<div class="strip ${scaleIndex === activeScaleIndex ? 'active' : ''}" data-scale-index="${String(scaleIndex)}">
									${scale.map((_, index) => `<swatch-button data-index="${String(index)}" data-scale-index="${String(scaleIndex)}"></swatch-button>`).join('')}
								</div>
							</div>
						`,
					)
					.join('')}
				<button class="add-scale-btn">+ Add Scale</button>
			</div>
		`

		// Set data on each swatch
		for (let [scaleIndex, scale] of fullScales.entries()) {
			for (let [index, step] of scale.entries()) {
				let element = this.shadow.querySelector(
					`swatch-button[data-index="${String(index)}"][data-scale-index="${String(scaleIndex)}"]`,
				)
				if (element) {
					/* @ts-expect-error This doesn't exist on Element? */
					// eslint-disable-next-line @typescript-eslint/no-unsafe-call
					element.setData(step, index, scaleIndex)
				}
			}
		}

		let addScaleButton = this.shadow.querySelector('.add-scale-btn')
		if (addScaleButton) {
			addScaleButton.addEventListener('click', () => {
				addScale()
			})
		}
	}

	private updateActiveStrip() {
		let activeScaleIndex = $activeScaleIndex.get()
		let strips = this.shadow.querySelectorAll('.strip')
		for (let strip of strips) {
			let stripScaleIndex = Number((strip as HTMLElement).dataset.scaleIndex)
			if (stripScaleIndex === activeScaleIndex) {
				strip.classList.add('active')
			} else {
				strip.classList.remove('active')
			}
		}
	}
}

customElements.define('color-strip', ColorStrip)
