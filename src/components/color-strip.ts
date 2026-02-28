import './swatch-button.js'

import { $fullScale } from '../stores/scale.js'
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
`

export class ColorStrip extends HTMLElement {
	private shadow: ShadowRoot
	private unsubscribers: Array<() => void> = []
	private swatchElements: Map<number, Element> = new Map()

	constructor() {
		super()
		this.shadow = this.attachShadow({ mode: 'open' })
	}

	connectedCallback() {
		this.render()

		// Subscribe to store changes - only re-render when scale changes
		this.unsubscribers.push(
			$fullScale.subscribe(() => {
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

		this.shadow.innerHTML = html`
			<style>
				${styles}
			</style>
			<div class="strip-container">
				<!--<div class="labels">
					${scale.map((step) => `<span class="label">${String(step.stop)}</span>`).join('')}
				</div>-->
				<div class="strip">
					${scale.map((_, index) => `<swatch-button data-index="${String(index)}"></swatch-button>`).join('')}
				</div>
			</div>
		`

		// Update swatch components with data
		this.swatchElements.clear()
		for (let [index, step] of scale.entries()) {
			let element = this.shadow.querySelector(`swatch-button[data-index="${String(index)}"]`)
			if (element) {
				/* @ts-expect-error This doesn't exist on Element? */
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call
				element.setData(step, index)
				this.swatchElements.set(index, element)
			}
		}
	}
}

customElements.define('color-strip', ColorStrip)
