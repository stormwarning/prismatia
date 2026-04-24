import { $gamut, resetScale, setGamut } from '../stores/scale.js'
import { css, html } from './_utilities.js'
import type { ExportDialog } from './export-dialog.js'

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
				<f-select id="gamut-select" value="${currentGamut}">
					<option value="srgb">sRGB</option>
					<option value="p3">Display P3</option>
				</f-select>
				<div class="actions">
					<button class="btn" id="reset-btn">Reset</button>
					<button class="btn primary" id="export-btn">Export</button>
				</div>
				<export-dialog></export-dialog>
			</div>
		`
	}

	private attachListeners() {
		// Gamut select
		this.shadow.querySelector('#gamut-select')?.addEventListener('change', () => {
			let select = this.shadow.querySelector<HTMLSelectElement>('#gamut-select')
			setGamut(select?.value as 'srgb' | 'p3')
		})

		// Reset
		this.shadow.querySelector('#reset-btn')?.addEventListener('click', () => {
			// eslint-disable-next-line no-alert
			if (confirm('Reset scale to defaults?')) {
				resetScale()
			}
		})

		// Export dialog
		this.shadow.querySelector('#export-btn')?.addEventListener('click', () => {
			let dialog = this.shadow.querySelector<ExportDialog>('export-dialog')
			dialog?.open()
		})
	}
}

customElements.define('global-controls', GlobalControls)
