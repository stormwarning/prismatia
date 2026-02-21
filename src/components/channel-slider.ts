import {
	clampToValidRanges,
	getValidRangesForChannel,
	oklchToHex,
	type ValueRange,
} from '../lib/color.js'
import { $activeColor, $gamut, updateActiveStep } from '../stores/scale.js'
// eslint-disable-next-line import-x/extensions
import { type Channel, CHANNEL_CONFIGS, type ColorStep } from '../types'
import { css, html } from './_utilities.js'

const GRADIENT_SAMPLES = 30

const styles = css`
	:host {
		display: block;
	}

	.slider {
		position: relative;
		block-size: 32px;
		touch-action: none;
		cursor: grab;
		user-select: none;
	}

	.slider.dragging {
		cursor: grabbing;
	}

	.sr-only {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		white-space: nowrap;
		border-width: 0;
		/* stylelint-disable-next-line property-no-deprecated */
		clip: rect(0, 0, 0, 0);
	}

	.track {
		position: absolute;
		inset-block-start: 50%;
		inset-inline: 0;
		block-size: 20px;
		overflow: hidden;
		background-color: rgb(255 255 255 / 16%);
		border-radius: 10px;
		transform: translateY(-50%);
	}

	.handle {
		position: absolute;
		inset-block-start: 0;
		inline-size: 10px;
		block-size: 32px;
		pointer-events: none;
		background: #fff;
		border: 1.5px solid rgb(0 0 0 / 25%);
		border-radius: 3px;
		box-shadow: 0 1px 4px rgb(0 0 0 / 35%);
		transform: translateX(-50%);
	}
`

function buildGradient(
	channel: 'L' | 'C' | 'H',
	color: ColorStep,
	validRanges: ValueRange[],
): string {
	let { min, max } = CHANNEL_CONFIGS[channel]
	let range = max - min
	let stops: string[] = []

	let sampleColor = (channelValue: number): string => {
		if (channel === 'L') return oklchToHex(channelValue, color.C, color.H)
		if (channel === 'C') return oklchToHex(color.L, channelValue, color.H)
		return oklchToHex(color.L, color.C, channelValue)
	}

	let previousEndPct = 0

	for (let [start, end] of validRanges) {
		let startPct = ((start - min) / range) * 100
		let endPct = ((end - min) / range) * 100

		// Transparent gap before this valid range
		if (previousEndPct < startPct) {
			stops.push(`transparent ${previousEndPct.toFixed(2)}%`, `transparent ${startPct.toFixed(2)}%`)
		}

		// Sharp start: color at the same percentage as the last transparent stop
		stops.push(`${sampleColor(start)} ${startPct.toFixed(2)}%`)

		// Interior color stops
		for (let index = 1; index < GRADIENT_SAMPLES; index++) {
			let t = index / GRADIENT_SAMPLES
			let v = start + t * (end - start)
			let pct = startPct + t * (endPct - startPct)
			stops.push(`${sampleColor(v)} ${pct.toFixed(2)}%`)
		}

		// Last stop at the end of the range
		stops.push(`${sampleColor(end)} ${endPct.toFixed(2)}%`)

		previousEndPct = endPct
	}

	// Trailing transparent gap
	if (previousEndPct < 100) {
		stops.push(`transparent ${previousEndPct.toFixed(2)}%`, `transparent 100%`)
	}

	if (stops.length === 0) return 'none'
	return `linear-gradient(to right, ${stops.join(', ')})`
}

export class ChannelSlider extends HTMLElement {
	static get observedAttributes() {
		return ['channel']
	}

	private shadow: ShadowRoot
	private unsubscribers: Array<() => void> = []
	private resizeObserver: ResizeObserver
	private currentColor: ColorStep | undefined
	private currentGamut: 'srgb' | 'p3' = 'srgb'
	private validRanges: ValueRange[] = []
	private isDragging = false

	get channel(): Channel {
		return (this.getAttribute('channel') ?? 'L') as Channel
	}

	private get currentValue(): number {
		if (!this.currentColor) return CHANNEL_CONFIGS[this.channel].min
		return this.currentColor[this.channel]
	}

	constructor() {
		super()
		this.shadow = this.attachShadow({ mode: 'open' })
		this.resizeObserver = new ResizeObserver(() => {
			this.updateHandlePosition()
		})
	}

	connectedCallback() {
		this.render()

		let slider = this.shadow.querySelector<HTMLElement>('.slider')
		if (slider) this.resizeObserver.observe(slider)

		this.attachListeners()

		this.unsubscribers.push(
			$activeColor.subscribe((color) => {
				this.currentColor = color
				this.recomputeRanges()
				this.updateGradient()
				this.updateHandlePosition()
				this.syncRangeInput()
			}),
			$gamut.subscribe((gamut) => {
				this.currentGamut = gamut
				this.recomputeRanges()
				this.updateGradient()
			}),
		)
	}

	disconnectedCallback() {
		for (let unsub of this.unsubscribers) unsub()
		this.unsubscribers = []
		this.resizeObserver.disconnect()
	}

	attributeChangedCallback() {
		if (this.isConnected) {
			this.recomputeRanges()
			this.updateGradient()
			this.updateHandlePosition()
		}
	}

	private recomputeRanges() {
		if (!this.currentColor) {
			this.validRanges = []
			return
		}

		this.validRanges = getValidRangesForChannel(this.channel, this.currentColor, this.currentGamut)
	}

	private render() {
		let ch = this.channel
		let config = CHANNEL_CONFIGS[ch]
		let label = ch === 'L' ? 'Lightness' : ch === 'C' ? 'Chroma' : 'Hue'

		this.shadow.innerHTML = html`
			<style>
				${styles}
			</style>
			<div class="slider">
				<input
					type="range"
					class="sr-only"
					min="${String(config.min)}"
					max="${String(config.max)}"
					step="${String(config.step)}"
					value="${String(this.currentValue)}"
					aria-label="${label}"
				/>
				<div class="track"></div>
				<div class="handle"></div>
			</div>
		`
	}

	private updateGradient() {
		let track = this.shadow.querySelector<HTMLElement>('.track')
		if (!track) return
		if (!this.currentColor) {
			track.style.backgroundImage = 'none'
			return
		}

		track.style.backgroundImage = buildGradient(this.channel, this.currentColor, this.validRanges)
	}

	private updateHandlePosition() {
		let handle = this.shadow.querySelector<HTMLElement>('.handle')
		let slider = this.shadow.querySelector<HTMLElement>('.slider')
		if (!handle || !slider) return

		let config = CHANNEL_CONFIGS[this.channel]
		let t = (this.currentValue - config.min) / (config.max - config.min)
		let sliderWidth = slider.getBoundingClientRect().width
		if (sliderWidth === 0) return
		handle.style.left = `${String(t * sliderWidth)}px`
	}

	private syncRangeInput() {
		let rangeInput = this.shadow.querySelector<HTMLInputElement>('input[type=range]')
		if (rangeInput) rangeInput.value = String(this.currentValue)
	}

	private attachListeners() {
		let slider = this.shadow.querySelector<HTMLElement>('.slider')
		let rangeInput = this.shadow.querySelector<HTMLInputElement>('input[type=range]')
		if (!slider) return

		let config = CHANNEL_CONFIGS[this.channel]

		let getValueFromClientX = (clientX: number): number => {
			let rect = slider.getBoundingClientRect()
			let t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
			let rawValue = config.min + t * (config.max - config.min)
			return clampToValidRanges(rawValue, this.validRanges)
		}

		slider.addEventListener('pointerdown', (event: PointerEvent) => {
			this.isDragging = true
			slider.classList.add('dragging')
			slider.setPointerCapture(event.pointerId)
			updateActiveStep({ [this.channel]: getValueFromClientX(event.clientX) })
		})

		slider.addEventListener('pointermove', (event: PointerEvent) => {
			if (!this.isDragging) return
			updateActiveStep({ [this.channel]: getValueFromClientX(event.clientX) })
		})

		let stopDrag = (event: PointerEvent) => {
			if (!this.isDragging) return
			this.isDragging = false
			slider.classList.remove('dragging')
			slider.releasePointerCapture(event.pointerId)
		}

		slider.addEventListener('pointerup', stopDrag)
		slider.addEventListener('pointercancel', stopDrag)

		if (rangeInput) {
			rangeInput.addEventListener('input', () => {
				let value = Number.parseFloat(rangeInput.value)
				if (!Number.isNaN(value)) {
					updateActiveStep({ [this.channel]: clampToValidRanges(value, this.validRanges) })
				}
			})
		}
	}
}

customElements.define('channel-slider', ChannelSlider)
