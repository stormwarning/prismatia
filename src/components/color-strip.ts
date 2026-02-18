import { getBestContrastColor, getContrastLevel } from '../lib/color.js'
import { $activeIndex, $fullScale, selectSwatch } from '../stores/scale.js'
import type { FullColorStep } from '../types'

const styles = `
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
    text-align: center;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    letter-spacing: 0.02em;
  }

  .strip {
    display: flex;
    height: 72px;
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-lg);
  }

  .swatch {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    cursor: pointer;
    transition: transform 0.12s ease-out;
    position: relative;
    border: none;
    background: none;
    padding: 0;
  }

  .swatch:hover {
    transform: scaleY(1.08);
    z-index: 1;
  }

  .swatch:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .swatch.active::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: white;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  }

  .swatch.out-of-gamut::after {
    content: '!';
    position: absolute;
    top: 4px;
    right: 4px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--error);
    font-size: 9px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .contrast-score {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .contrast-level {
    font-family: var(--font-mono);
    font-size: 9px;
    font-weight: 500;
    opacity: 0.8;
    letter-spacing: 0.04em;
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

		this.shadow.innerHTML = `
      <style>${styles}</style>
      <div class="strip-container">
        <div class="labels">
          ${scale.map((step) => `<span class="label">${String(step.stop)}</span>`).join('')}
        </div>
        <div class="strip">
          ${scale.map((step, index) => this.renderSwatch(step, index, index === activeIndex)).join('')}
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

		return `
      <button
        class="${classes}"
        style="background: ${step.hex}; color: ${color}"
        data-index="${String(index)}"
        aria-label="Select color ${String(step.stop)}"
        aria-pressed="${String(active)}"
      >
        <span class="contrast-score">${ratio.toFixed(1)}</span>
        <span class="contrast-level">${level}</span>
      </button>
    `
	}
}

customElements.define('color-strip', ColorStrip)
