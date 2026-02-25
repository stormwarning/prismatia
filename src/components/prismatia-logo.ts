import { $activeFullColor } from '../stores/scale.js'
import { css, html } from './_utilities.js'

const styles = css`
	:host {
		display: contents;

		@property --hue {
			syntax: '<number>';
			inherits: false;
			initial-value: 310;
		}
	}

	.logo {
		--hue: 310;
		--rotation: 0;

		display: flex;
		gap: 8px;
		align-items: center;
	}

	/* Initial animation: rotate 360deg + offset to reach target hue */
	.logo.initial-load {
		.logo-low,
		.logo-overlay,
		.logo-medium,
		.logo-blend,
		.logo-high {
			animation: rotate-hue 2s linear;
		}
	}

	svg {
		inline-size: 32px;
		block-size: 32px;
	}

	.logo-low {
		fill: #306;
		fill: oklch(27.57% 0.1499 calc(var(--hue) - 13));
	}

	.logo-overlay {
		opacity: 0.75;
		fill: #b446ff;

		/* hue - 3 = 307 */
		fill: oklch(63% 0.2605 calc(var(--hue) - 3));
	}

	.logo-medium {
		fill: #c774ff;
		fill: oklch(70.67% 0.2066 var(--hue));
	}

	.logo-blend {
		mix-blend-mode: multiply;
		opacity: 0.75;
		fill: #00e7ff;

		/* hue - 102 = 208 */
		fill: oklch(84.89% 0.146 calc(var(--hue) - 102));

		@supports (mix-blend-mode: plus-darker) {
			/* stylelint-disable-next-line declaration-property-value-no-unknown */
			mix-blend-mode: plus-darker;
		}
	}

	.logo-high {
		fill: #40edff;

		/* hue - 104 = 206 */
		fill: oklch(86.9% 0.1361 calc(var(--hue) - 104));
	}

	@keyframes rotate-hue {
		to {
			--hue: calc(670);
		}
	}
`

const template = html`
	<div class="logo initial-load">
		<svg width="32" height="32" viewBox="0 0 576 576" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				class="logo-low"
				d="M39 185.606C39 159.863 52.7441 136.079 75.048 123.225L252.048 21.2153C300.048 -6.4482 360 28.1959 360 83.5968V288.394C360 314.137 346.256 337.921 323.952 350.775L146.952 452.785C98.952 480.448 39 445.804 39 390.403V185.606Z"
			/>
			<path
				class="logo-overlay"
				d="M357.677 65.166C359.187 70.985 360 77.1501 360 83.5967V288.394C360 314.136 346.256 337.921 323.952 350.775L146.952 452.784C141.527 455.911 135.949 458.238 130.322 459.833C128.812 454.014 128 447.849 128 441.403V236.606C128 210.864 141.744 187.079 164.048 174.225L341.048 72.2158C346.473 69.0895 352.051 66.7608 357.677 65.166Z"
			/>
			<path
				class="logo-medium"
				fill-rule="evenodd"
				clip-rule="evenodd"
				d="M357.677 65.1656C401.834 52.6494 449 85.4574 449 134.597V339.394C449 365.137 435.256 388.921 412.952 401.775L235.952 503.785C193.537 528.229 141.792 504.023 130.323 459.834C135.949 458.239 141.528 455.911 146.952 452.785L323.952 350.775C346.256 337.921 360 314.137 360 288.394V83.5973C360 77.1506 359.187 70.9848 357.677 65.1656Z"
			/>
			<path
				class="logo-blend"
				d="M446.608 115.907C448.162 121.802 449 128.054 449 134.597V339.394C449 365.136 435.256 388.921 412.952 401.775L235.952 503.784C230.228 507.083 224.333 509.495 218.391 511.092C216.837 505.197 216 498.945 216 492.403V287.606C216 261.864 229.744 238.079 252.048 225.225L429.048 123.216C434.772 119.917 440.666 117.504 446.608 115.907Z"
			/>
			<path
				class="logo-high"
				d="M446.608 115.907C490.494 104.111 537 136.803 537 185.597V390.394C537 416.137 523.256 439.921 500.952 452.776L323.952 554.784C281.62 579.182 229.993 555.116 218.391 511.091C224.333 509.494 230.228 507.083 235.952 503.784L412.952 401.776C435.256 388.921 449 365.137 449 339.394V134.597C449 128.055 448.162 121.802 446.608 115.907Z"
			/>
		</svg>
	</div>
`

export class PrismatiaLogo extends HTMLElement {
	// eslint-disable-next-line unicorn/no-null
	private logoEl: HTMLElement | null = null

	connectedCallback() {
		let shadow = this.attachShadow({ mode: 'open' })

		let styleElement = document.createElement('style')
		styleElement.textContent = styles

		let templateElement = document.createElement('template')
		templateElement.innerHTML = template

		shadow.append(styleElement)
		shadow.append(templateElement.content.cloneNode(true))

		this.logoEl = shadow.querySelector('.logo')
		this.logoEl?.classList.add('initial-load')

		// Subscribe to active color changes
		$activeFullColor.subscribe((color) => {
			if (this.logoEl && color) {
				let currentHue = color.H
				let baseHue = 310
				let rotation = currentHue - baseHue

				// Remove the initial animation class
				// this.logoEl.classList.remove('initial-load')

				// Update the rotation without animation
				this.logoEl.style.setProperty('--rotation', String(rotation))
				this.logoEl.style.setProperty('--hue', String(currentHue))
			}
		})
	}
}

customElements.define('prismatia-logo', PrismatiaLogo)
