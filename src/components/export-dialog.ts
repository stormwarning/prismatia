import { exportAsCSS, exportAsDesignTokensJSON } from '../stores/scale.js'
import { css, html } from './_utilities.js'

type ExportFormat = 'css' | 'json'

const styles = css`
	dialog {
		inline-size: 90vi;
		max-inline-size: 720px;
		max-block-size: 80dvb;
		padding: 0;
		color: var(--grey-950);
		background: var(--grey-100);
		border: 1px solid var(--grey-300);
		border-radius: var(--radius-md);
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 50%);
	}

	.layout {
		display: grid;
		grid-template-rows: 1fr auto;
		grid-template-columns: 160px 1fr;
		block-size: min(60dvb, 480px);
	}

	.sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding: var(--space-md);
		border-inline-end: 1px solid var(--grey-300);
	}

	.sidebar-label {
		margin-block-end: var(--space-xs);
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		color: var(--grey-500);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.format-option {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		padding: var(--space-xs) var(--space-sm);
		font-family: var(--font-mono);
		font-size: 13px;
		cursor: pointer;
		border-radius: var(--radius-sm);
	}

	.format-option:hover {
		background: var(--grey-200);
	}

	.format-option input {
		margin: 0;
	}

	.preview {
		padding: var(--space-md);
		overflow: auto;
	}

	.preview pre {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.6;
		word-break: break-all;
		white-space: pre-wrap;
	}

	.footer {
		display: flex;
		grid-column: 1 / -1;
		gap: var(--space-sm);
		justify-content: flex-end;
		padding: var(--space-sm) var(--space-md);
		border-block-start: 1px solid var(--grey-300);
	}

	.btn {
		padding: 7px 14px;
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 500;
		color: var(--grey-950);
		cursor: pointer;
		background: var(--grey-200);
		border: 1px solid var(--grey-300);
		border-radius: var(--radius-md);
		transition: all 0.12s;
	}

	.btn:hover {
		background: var(--grey-300);
	}

	.btn.primary {
		color: #fff;
		background: var(--accent);
		border-color: var(--accent);
	}

	.btn.primary:hover {
		background: var(--accent-hover);
	}

	@media (prefers-color-scheme: dark) {
		.btn {
			color: var(--grey-950);
		}

		.btn.primary {
			color: #fff;
		}
	}
`

export class ExportDialog extends HTMLElement {
	private shadow: ShadowRoot
	private selectedFormat: ExportFormat = 'css'

	constructor() {
		super()
		this.shadow = this.attachShadow({ mode: 'open' })
	}

	connectedCallback() {
		this.render()
		this.attachListeners()
	}

	open() {
		this.selectedFormat = 'css'
		this.render()
		this.attachListeners()
		this.dialog.showModal()
	}

	private get dialog(): HTMLDialogElement {
		return this.shadow.querySelector('dialog')!
	}

	private getPreviewContent(): string {
		return this.selectedFormat === 'css' ? exportAsCSS() : exportAsDesignTokensJSON()
	}

	private render() {
		let preview = this.getPreviewContent()

		this.shadow.innerHTML = html`
			<style>
				${styles}
			</style>
			<dialog>
				<div class="layout">
					<div class="sidebar">
						<div class="sidebar-label">Format</div>
						<label class="format-option">
							<input
								type="radio"
								name="format"
								value="css"
								${this.selectedFormat === 'css' ? 'checked' : ''}
							/>
							CSS
						</label>
						<label class="format-option">
							<input
								type="radio"
								name="format"
								value="json"
								${this.selectedFormat === 'json' ? 'checked' : ''}
							/>
							Design Tokens
						</label>
					</div>
					<div class="preview">
						<pre><code>${this.escapeHtml(preview)}</code></pre>
					</div>
					<div class="footer">
						<button class="btn" id="close-btn">Close</button>
						<button class="btn primary" id="copy-btn">Copy</button>
					</div>
				</div>
			</dialog>
		`
	}

	private escapeHtml(text: string): string {
		return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
	}

	private attachListeners() {
		// Format radio buttons
		for (let radio of this.shadow.querySelectorAll<HTMLInputElement>('input[name="format"]')) {
			radio.addEventListener('change', () => {
				this.selectedFormat = radio.value as ExportFormat
				this.updatePreview()
			})
		}

		// Copy button
		this.shadow
			.querySelector('#copy-btn')
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			?.addEventListener('click', async () => {
				let content = this.getPreviewContent()
				await navigator.clipboard.writeText(content)
				let button = this.shadow.querySelector('#copy-btn')!
				button.textContent = 'Copied!'
				setTimeout(() => {
					button.textContent = 'Copy'
				}, 1500)
			})

		// Close button
		this.shadow.querySelector('#close-btn')?.addEventListener('click', () => {
			this.dialog.close()
		})

		// Backdrop click
		this.dialog.addEventListener('click', (event) => {
			if (event.target === this.dialog) {
				this.dialog.close()
			}
		})
	}

	private updatePreview() {
		let preview = this.getPreviewContent()
		let code = this.shadow.querySelector('code')
		if (code) {
			code.textContent = preview
		}
	}
}

customElements.define('export-dialog', ExportDialog)
