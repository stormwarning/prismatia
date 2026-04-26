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

		display: flex;
		gap: 8px;
		align-items: center;
	}

	/* Initial animation: full 360° spin landing on the JS-supplied target hue */
	.logo.initial-load {
		.logo-low,
		.logo-overlay,
		.logo-medium,
		.logo-blend,
		.logo-high {
			animation: rotate-hue 2s linear;
		}
	}

	.logo:not(.initial-load) {
		.logo-low,
		.logo-overlay,
		.logo-medium,
		.logo-blend,
		.logo-high {
			transition: --hue 400ms ease;
		}
	}

	svg {
		inline-size: 32px;
		block-size: 32px;
	}

	.logo-low {
		fill: #306;
		fill: oklch(27.57% 0.1499 calc(var(--hue) - 13));

		@media (prefers-color-scheme: dark) {
			stroke: rgb(255 255 255 / 30%);
			stroke-width: 0.5;
		}
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
		from {
			--hue: 310;
		}
		to {
			--hue: var(--target-hue);
		}
	}
`

const template = html`
	<div class="logo initial-load">
		<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none">
			<path
				class="logo-low"
				d="M2.167 10.311a4 4 0 0 1 2.002-3.465l9.834-5.667C16.669-.358 20 1.566 20 4.644v11.378a4 4 0 0 1-2.003 3.466l-9.833 5.667c-2.667 1.537-5.997-.388-5.997-3.466z"
			/>
			<path
				class="logo-overlay"
				d="M19.869 3.622q.128.485.13 1.022v11.378a4 4 0 0 1-2.001 3.466l-9.834 5.666c-.301.174-.611.3-.923.39a4 4 0 0 1-.13-1.021V13.145a4 4 0 0 1 2.003-3.466l9.833-5.667q.452-.258.922-.39"
			/>
			<path
				class="logo-medium"
				d="M19.87 3.622c2.453-.697 5.074 1.125 5.074 3.856v11.378c0 1.43-.764 2.751-2.003 3.465l-9.833 5.667c-2.357 1.359-5.231.012-5.867-2.445.312-.088.622-.215.923-.389l9.833-5.667A4 4 0 0 0 20 16.022V4.645c0-.358-.047-.7-.13-1.023"
			/>
			<path
				class="logo-blend"
				d="M24.81 6.44c.086.328.134.674.134 1.037v11.378a4 4 0 0 1-2.003 3.466l-9.833 5.667a4 4 0 0 1-.974.404A4 4 0 0 1 12 27.355V15.978a4 4 0 0 1 2.003-3.465l9.833-5.667q.477-.273.974-.406"
			/>
			<path
				class="logo-high"
				d="M24.81 6.44c2.438-.656 5.023 1.16 5.023 3.87V21.69a4 4 0 0 1-2.002 3.466l-9.834 5.667c-2.352 1.355-5.22.017-5.863-2.43q.497-.131.974-.404l9.833-5.667a4 4 0 0 0 2.003-3.466V7.478c0-.363-.048-.71-.134-1.037"
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

		let isFirstLoad = true
		$activeFullColor.subscribe((color) => {
			if (!this.logoEl || !color) return

			let currentHue = color.H
			this.logoEl.style.setProperty('--hue', String(currentHue))

			if (isFirstLoad) {
				isFirstLoad = false
				this.logoEl.style.setProperty('--target-hue', String(currentHue + 360))
				let path = this.logoEl.querySelector('.logo-medium')
				path?.addEventListener(
					'animationend',
					() => this.logoEl?.classList.remove('initial-load'),
					{ once: true },
				)
			}
		})
	}
}

customElements.define('prismatia-logo', PrismatiaLogo)
