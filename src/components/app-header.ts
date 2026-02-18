import { exportAsCSS, exportAsJSON, globalNudge, resetScale } from '../stores/scale.js'
import type { Channel } from '../types'

const styles = `
  :host {
    display: block;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-lg);
    flex-wrap: wrap;
  }

  .title {
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    flex-wrap: wrap;
  }

  .nudge-group {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .nudge-label {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .nudge-buttons {
    display: flex;
    gap: 4px;
  }

  .nudge-btn {
    background: var(--surface-2);
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    width: 32px;
    height: 28px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s;
  }

  .nudge-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text);
    border-color: var(--border-2);
  }

  .actions {
    display: flex;
    gap: var(--space-sm);
  }

  .btn {
    background: var(--surface-2);
    border: 1px solid var(--border-2);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 7px 14px;
    border-radius: var(--radius-md);
    font-weight: 500;
    transition: all 0.12s;
  }

  .btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .btn.primary {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .btn.primary:hover {
    background: var(--accent-hover);
  }
`

export class AppHeader extends HTMLElement {
	private shadow: ShadowRoot

	constructor() {
		super()
		this.shadow = this.attachShadow({ mode: 'open' })
	}

	connectedCallback() {
		this.render()
		this.attachListeners()
	}

	private render() {
		this.shadow.innerHTML = `
      <style>${styles}</style>
      <header class="header">
        <h1 class="title">Prismatia</h1>
        <div class="controls">
          <div class="nudge-group">
            <span class="nudge-label">Nudge All</span>
            <div class="nudge-buttons">
              <button class="nudge-btn" data-channel="L" data-delta="-0.05" title="L -5%">L−</button>
              <button class="nudge-btn" data-channel="L" data-delta="0.05" title="L +5%">L+</button>
              <button class="nudge-btn" data-channel="C" data-delta="-0.01" title="C -0.01">C−</button>
              <button class="nudge-btn" data-channel="C" data-delta="0.01" title="C +0.01">C+</button>
              <button class="nudge-btn" data-channel="H" data-delta="-5" title="H -5°">H−</button>
              <button class="nudge-btn" data-channel="H" data-delta="5" title="H +5°">H+</button>
            </div>
          </div>
          <div class="actions">
            <button class="btn" id="reset-btn">Reset</button>
            <button class="btn" id="export-json-btn">Export JSON</button>
            <button class="btn primary" id="copy-css-btn">Copy CSS</button>
          </div>
        </div>
      </header>
    `
	}

	private attachListeners() {
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
		toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--surface-3);
      color: var(--text);
      padding: 12px 20px;
      border-radius: var(--radius-md);
      font-family: var(--font-mono);
      font-size: 13px;
      box-shadow: var(--shadow-lg);
      z-index: 1000;
      animation: toast-in 0.2s ease-out;
    `
		document.body.append(toast)
		setTimeout(() => {
			toast.remove()
		}, 2000)
	}
}

customElements.define('app-header', AppHeader)
