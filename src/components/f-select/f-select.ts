import { css, html } from '../_utilities.js'

const OPTION_HEIGHT = 32
const PICKER_PADDING_BLOCK = 4

const styles = css`
	:host {
		--_option-height: ${String(OPTION_HEIGHT)}px;
		--_picker-padding-block: ${String(PICKER_PADDING_BLOCK)}px;
		--icon-light: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>');
				--icon-dark: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>');
				--select-icon: var(--icon-dark);

		display: inline-block;

				@media (prefers-color-scheme: dark) {
					--select-icon: var(--icon-light);
				}
	}

	select,
	select::picker(select) {
		appearance: base-select;
	}

	select {
		display: inline-flex;
		gap: var(--space-sm, 8px);
		align-items: center;
		padding: 6px 12px;
		anchor-name: --f-select;
		font-family: var(--text-family-mono, monospace);
		font-size: 12px;
		color: var(--ui-foreground);
		cursor: pointer;
		background: var(--ui-bg-secondary);
		border: 1px solid var(--ui-border);
		border-radius: var(--radius-sm, 2px);
		transition:
			background 0.12s,
			border-color 0.12s,
			scale 0.12s;
		will-change: scale;
	}

	select:hover {
		border-color: var(--grey-400);
	}

	select:active {
		scale: 0.98;
	}

	select:focus-visible {
		outline: 2px solid var(--grey-500);
		outline-offset: 2px;
	}

	select::picker-icon {
		inline-size: 14px;
		block-size: 14px;
		content: var(--select-icon);
		opacity: 0.5;
		transition: rotate 0.2s ease;
	}

	select::picker(select) {
		position: fixed;
		inset: auto;
		inset-block-start: calc(anchor(start) - var(--_anchor-offset, 0px));
		inset-inline-start: anchor(start);
		padding-block: var(--_picker-padding-block);
		margin: 0;
		position-anchor: --f-select;
		background: var(--ui-bg-primary);
		border: 1px solid var(--ui-border);
		border-radius: var(--radius-md, 4px);
		box-shadow:
			0 4px 16px rgb(0 0 0 / 15%),
			0 1px 4px rgb(0 0 0 / 10%);
		opacity: 0;
		transform-origin: 50% var(--_anchor-offset, 0);
		scale: 0.96;
		transition:
			opacity 0.15s ease,
			scale 0.15s ease,
			display 0.15s allow-discrete,
			overlay 0.15s allow-discrete;
	}

	select:open::picker(select) {
		opacity: 1;
		scale: 1;
	}

	@starting-style {
		select:open::picker(select) {
			opacity: 0;
			scale: 0.96;
		}
	}

	option {
		display: flex;
		align-items: center;
		block-size: var(--_option-height);
		padding-inline: 12px;
		margin-inline: 4px;
		font-family: var(--text-family-mono, monospace);
		font-size: 12px;
		cursor: pointer;
		border-radius: var(--radius-sm, 2px);
		transition: background 0.08s;
	}

	option:hover {
		background: color-mix(in srgb, var(--ui-foreground) 8%, transparent);
	}

	option:checked {
		font-weight: 500;
		background: color-mix(in srgb, var(--ui-foreground) 10%, transparent);
	}

	option::checkmark {
		display: none;
	}
`

export class FSelect extends HTMLElement {
	private shadow: ShadowRoot

	static get observedAttributes(): string[] {
		return ['value']
	}

	constructor() {
		super()
		this.shadow = this.attachShadow({ mode: 'open' })
	}

	connectedCallback(): void {
		this.render()
		this.selectEl.addEventListener('beforetoggle', this._onBeforeToggle)
		this.selectEl.addEventListener('change', this._onChange)
	}

	disconnectedCallback(): void {
		this.selectEl.removeEventListener('beforetoggle', this._onBeforeToggle)
		this.selectEl.removeEventListener('change', this._onChange)
	}

	attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
		if (name === 'value' && value !== null) {
			this.selectEl.value = value
		}
	}

	get selectEl(): HTMLSelectElement {
		return this.shadow.querySelector('select')!
	}

	get value(): string {
		return this.selectEl.value
	}

	set value(v: string) {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (this.selectEl) {
			this.selectEl.value = v
		}
	}

	private render(): void {
		let options = ''
		for (let child of this.children) {
			if (child.tagName === 'OPTION') {
				options += (child as HTMLOptionElement).outerHTML
			}
		}

		let initialValue = this.getAttribute('value')

		this.shadow.innerHTML = html`
			<style>
				${styles}
			</style>
			<select>
				${options}
			</select>
		`

		if (initialValue) {
			this.selectEl.value = initialValue
		}
	}

	private _updateAnchorOffset(): void {
		let offset = PICKER_PADDING_BLOCK + this.selectEl.selectedIndex * OPTION_HEIGHT
		this.selectEl.style.setProperty('--_anchor-offset', `${String(offset)}px`)
	}

	private _onBeforeToggle = (_event: Event): void => {
		let event = _event as ToggleEvent
		if (event.newState === 'open') {
			this._updateAnchorOffset()
		}
	}
	private _onChange = (): void => {
		this.dispatchEvent(new Event('change', { bubbles: true }))
	}
}

customElements.define('f-select', FSelect)
