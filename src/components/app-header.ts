import {
	$gamut,
	exportAsCSS,
	exportAsJSON,
	globalNudge,
	resetScale,
	setGamut,
} from '../stores/scale.js'
import type { Channel } from '../types'
import { css, html } from './_utilities.js'

const styles = css`
	:host {
		display: block;
	}

	.header {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-lg);
		align-items: center;
		justify-content: space-between;
	}

	.logo {
		display: flex;
		gap: 8px;
		align-items: center;

		svg {
			inline-size: 32px;
			block-size: 32px;
		}
	}

	.title {
		font-size: 20px;
		font-weight: 600;
		letter-spacing: -0.02em;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-lg);
		align-items: center;
	}

	.nudge-group {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.gamut-select {
		padding: 6px 12px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		transition: all 0.12s;
	}

	.gamut-select:hover {
		background: rgb(255 255 255 / 8%);
		border-color: var(--border-2);
	}

	.gamut-select:focus {
		outline: 1px solid var(--border-focus);
		outline-offset: -1px;
	}

	.nudge-label {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.nudge-buttons {
		display: flex;
		gap: 4px;
	}

	.nudge-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		inline-size: 32px;
		block-size: 28px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--text-muted);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		transition: all 0.12s;
	}

	.nudge-btn:hover {
		color: var(--text);
		background: rgb(255 255 255 / 8%);
		border-color: var(--border-2);
	}

	.actions {
		display: flex;
		gap: var(--space-sm);
	}

	.btn {
		padding: 7px 14px;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 500;
		color: var(--text);
		background: var(--surface-2);
		border: 1px solid var(--border-2);
		border-radius: var(--radius-md);
		transition: all 0.12s;
	}

	.btn:hover {
		background: rgb(255 255 255 / 10%);
		border-color: rgb(255 255 255 / 20%);
	}

	.btn.primary {
		color: #fff;
		background: var(--accent);
		border-color: var(--accent);
	}

	.btn.primary:hover {
		background: var(--accent-hover);
	}
`

export class AppHeader extends HTMLElement {
	private shadow: ShadowRoot
	private unsubscribers: Array<() => void> = []

	constructor() {
		super()
		this.shadow = this.attachShadow({ mode: 'open' })
	}

	connectedCallback() {
		this.render()
		this.attachListeners()

		// Subscribe to gamut changes to re-render
		this.unsubscribers.push(
			$gamut.subscribe(() => {
				this.render()
				this.attachListeners()
			}),
		)
	}

	disconnectedCallback() {
		for (let unsub of this.unsubscribers) unsub()
		this.unsubscribers = []
	}

	private render() {
		let currentGamut = $gamut.get()

		this.shadow.innerHTML = html`
			<style>
				${styles}
			</style>
			<header class="header">
				<div class="logo">
				<svg width="56" height="56" viewBox="0 0 576 576" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M39 185.606C39 159.863 52.7441 136.079 75.048 123.225L252.048 21.2153C300.048 -6.4482 360 28.1959 360 83.5968V288.394C360 314.137 346.256 337.921 323.952 350.775L146.952 452.785C98.952 480.448 39 445.804 39 390.403V185.606Z" fill="#330066" style="fill:#330066;fill:color(display-p3 0.2000 0.0000 0.4000);fill-opacity:1;"/>
<path opacity="0.75" d="M357.677 65.166C359.187 70.985 360 77.1501 360 83.5967V288.394C360 314.136 346.256 337.921 323.952 350.775L146.952 452.784C141.527 455.911 135.949 458.238 130.322 459.833C128.812 454.014 128 447.849 128 441.403V236.606C128 210.864 141.744 187.079 164.048 174.225L341.048 72.2158C346.473 69.0895 352.051 66.7608 357.677 65.166Z" fill="#B446FF" style="fill:#B446FF;fill:color(display-p3 0.7059 0.2745 1.0000);fill-opacity:1;"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M357.677 65.1656C401.834 52.6494 449 85.4574 449 134.597V339.394C449 365.137 435.256 388.921 412.952 401.775L235.952 503.785C193.537 528.229 141.792 504.023 130.323 459.834C135.949 458.239 141.528 455.911 146.952 452.785L323.952 350.775C346.256 337.921 360 314.137 360 288.394V83.5973C360 77.1506 359.187 70.9848 357.677 65.1656Z" fill="#C774FF" style="fill:#C774FF;fill:color(display-p3 0.7804 0.4549 1.0000);fill-opacity:1;"/>
<g opacity="0.75" style="mix-blend-mode:plus-darker">
<path d="M446.608 115.907C448.162 121.802 449 128.054 449 134.597V339.394C449 365.136 435.256 388.921 412.952 401.775L235.952 503.784C230.228 507.083 224.333 509.495 218.391 511.092C216.837 505.197 216 498.945 216 492.403V287.606C216 261.864 229.744 238.079 252.048 225.225L429.048 123.216C434.772 119.917 440.666 117.504 446.608 115.907Z" fill="#00E7FF" style="fill:#00E7FF;fill:color(display-p3 0.0000 0.9059 1.0000);fill-opacity:1;"/>
</g>
<path d="M446.608 115.907C490.494 104.111 537 136.803 537 185.597V390.394C537 416.137 523.256 439.921 500.952 452.776L323.952 554.784C281.62 579.182 229.993 555.116 218.391 511.091C224.333 509.494 230.228 507.083 235.952 503.784L412.952 401.776C435.256 388.921 449 365.137 449 339.394V134.597C449 128.055 448.162 121.802 446.608 115.907Z" fill="#40EDFF" style="fill:#40EDFF;fill:color(display-p3 0.2510 0.9294 1.0000);fill-opacity:1;"/>
</svg>

				<h1 class="title">Prismatia</h1>
				</div>
				<div class="controls">
					<select class="gamut-select" id="gamut-select">
						<option value="srgb" ${currentGamut === 'srgb' ? 'selected' : ''}>sRGB</option>
						<option value="p3" ${currentGamut === 'p3' ? 'selected' : ''}>Display P3</option>
					</select>
					<div class="nudge-group">
						<span class="nudge-label">Nudge All</span>
						<div class="nudge-buttons">
							<button
								class="nudge-btn"
								data-channel="L"
								data-delta="-0.05"
								title="L -5%"
							>
								L−
							</button>
							<button
								class="nudge-btn"
								data-channel="L"
								data-delta="0.05"
								title="L +5%"
							>
								L+
							</button>
							<button
								class="nudge-btn"
								data-channel="C"
								data-delta="-0.01"
								title="C -0.01"
							>
								C−
							</button>
							<button
								class="nudge-btn"
								data-channel="C"
								data-delta="0.01"
								title="C +0.01"
							>
								C+
							</button>
							<button
								class="nudge-btn"
								data-channel="H"
								data-delta="-5"
								title="H -5°"
							>
								H−
							</button>
							<button
								class="nudge-btn"
								data-channel="H"
								data-delta="5"
								title="H +5°"
							>
								H+
							</button>
						</div>
					</div>
					<div class="actions">
						<button class="btn" id="reset-btn">Reset</button>
						<button class="btn" id="export-json-btn">
							Export JSON
						</button>
						<button class="btn primary" id="copy-css-btn">
							Copy CSS
						</button>
					</div>
				</div>
			</header>
		`
	}

	private attachListeners() {
		// Gamut select
		this.shadow.querySelector('#gamut-select')?.addEventListener('change', (event) => {
			let select = event.target as HTMLSelectElement
			setGamut(select.value as 'srgb' | 'p3')
		})

		// Nudge buttons
		for (let button of this.shadow.querySelectorAll<HTMLButtonElement>('.nudge-btn')) {
			button.addEventListener('click', () => {
				let channel = button.dataset.channel as Channel
				let delta = Number.parseFloat(button.dataset.delta ?? '0')
				globalNudge(channel, delta)
			})
		}

		// Reset
		this.shadow.querySelector('#reset-btn')?.addEventListener('click', () => {
			// eslint-disable-next-line no-alert
			if (confirm('Reset scale to defaults?')) {
				resetScale()
			}
		})

		// Export JSON
		this.shadow
			.querySelector('#export-json-btn')
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			?.addEventListener('click', async () => {
				let json = exportAsJSON()
				await navigator.clipboard.writeText(json)
				this.showToast('JSON copied to clipboard')
			})

		// Copy CSS
		this.shadow
			.querySelector('#copy-css-btn')
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			?.addEventListener('click', async () => {
				let css = exportAsCSS()
				await navigator.clipboard.writeText(css)
				this.showToast('CSS copied to clipboard')
			})
	}

	private showToast(message: string) {
		// Simple toast - could be enhanced
		let toast = document.createElement('div')
		toast.textContent = message
		toast.style.cssText = css`
  	position: fixed;
  	inset-block-end: 20px;
  	inset-inline-start: 50%;
  	z-index: 1000;
  	padding: 12px 20px;
  	font-family: var(--font-mono);
  	font-size: 13px;
  	color: var(--text);
  	background: var(--surface-3);
  	border-radius: var(--radius-md);
  	box-shadow: var(--shadow-lg);
  	transform: translateX(-50%);
  	animation: toast-in 0.2s ease-out;
  `
		document.body.append(toast)
		setTimeout(() => {
			toast.remove()
		}, 2000)
	}
}

customElements.define('app-header', AppHeader)
