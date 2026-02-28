import { $gamut, exportAsCSS, exportAsJSON, resetScale, setGamut } from '../stores/scale.js'
import { css, html } from './_utilities.js'

const styles = css`
	:host {
		display: block;
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

	.actions {
		display: flex;
		gap: var(--space-sm);
	}

	.btn {
		padding: 7px 14px;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 500;
		color: var(--ui-forground);
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
		background: var(--accent);
		border-color: var(--accent);
	}

	.btn.primary:hover {
		background: var(--accent-hover);
	}
`

export class GlobalControls extends HTMLElement {
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
			<div class="controls">
				<select class="gamut-select" id="gamut-select">
					<option value="srgb" ${currentGamut === 'srgb' ? 'selected' : ''}>sRGB</option>
					<option value="p3" ${currentGamut === 'p3' ? 'selected' : ''}>Display P3</option>
				</select>
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
		`
	}

	private attachListeners() {
		// Gamut select
		this.shadow.querySelector('#gamut-select')?.addEventListener('change', (event) => {
			let select = event.target as HTMLSelectElement
			setGamut(select.value as 'srgb' | 'p3')
		})

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

customElements.define('global-controls', GlobalControls)
