/* eslint-disable yoda */
import { getValidRangesForChannel, type ValueRange } from '../lib/color.js'
import { $activeIndex, $fullScale, selectSwatch, updateStep } from '../stores/scale.js'
// eslint-disable-next-line import-x/extensions
import { type Channel, CHANNEL_CONFIGS, type FullColorStep } from '../types'
import { css, html } from './_utilities.js'

const styles = css`
	:host {
		display: block;
	}

	.graph-wrapper {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
	}

	.graph-title {
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-dim);
		margin-bottom: var(--space-md);
	}

	svg {
		width: 100%;
		height: 200px;
		display: block;
		cursor: crosshair;
		overflow: visible;
	}

	.grid-line {
		stroke: rgba(255, 255, 255, 0.06);
		stroke-width: 1;
	}

	.invalid-region {
		fill: rgba(255, 255, 255, 0.04);
	}

	.value-line {
		fill: none;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.point-group {
		cursor: grab;
	}

	.point-group:active {
		cursor: grabbing;
	}

	.point-bg {
		fill: #13141a;
	}

	.point-color {
		transition: r 0.1s ease-out;
	}

	.point-group:hover .point-color {
		r: 7;
	}

	.point-ring {
		fill: none;
		stroke: white;
		stroke-width: 2;
		opacity: 0;
	}

	.point-group.active .point-ring {
		opacity: 1;
	}

	.value-label {
		font-family: 'IBM Plex Mono', monospace;
		font-size: 10px;
		fill: rgba(255, 255, 255, 0.6);
		text-anchor: middle;
	}

	.value-label.active {
		fill: white;
		font-weight: 600;
	}
`

interface DragState {
	dragging: boolean
	pointIndex?: number
}

export class LchGraph extends HTMLElement {
	private shadow: ShadowRoot
	private svg!: SVGSVGElement
	private unsubscribers: Array<() => void> = []
	private dragState: DragState = { dragging: false, pointIndex: undefined }
	private resizeObserver?: ResizeObserver
	// Padding
	private readonly PAD = { l: 20, r: 20, t: 10, b: 30 }

	static get observedAttributes() {
		return ['channel']
	}

	get channel(): Channel {
		return (this.getAttribute('channel') ?? 'L') as Channel
	}

	constructor() {
		super()
		this.shadow = this.attachShadow({ mode: 'open' })
	}

	connectedCallback() {
		this.render()

		this.unsubscribers.push(
			$fullScale.subscribe(() => {
				this.updateGraph()
			}),
			$activeIndex.subscribe(() => {
				this.updateGraph()
			}),
		)

		// Handle resize
		this.resizeObserver = new ResizeObserver(() => {
			this.updateGraph()
		})
		this.resizeObserver.observe(this)
	}

	disconnectedCallback() {
		for (let unsub of this.unsubscribers) unsub()
		this.unsubscribers = []
		this.resizeObserver?.disconnect()
	}

	attributeChangedCallback() {
		this.updateGraph()
	}

	private render() {
		let config = CHANNEL_CONFIGS[this.channel]

		this.shadow.innerHTML = html`
			<style>
				${styles}
			</style>
			<div class="graph-wrapper">
				<div class="graph-title">${config.label}</div>
				<svg viewBox="0 0 100 200" preserveAspectRatio="none">
					<g class="grid"></g>
					<g class="invalid-regions"></g>
					<path class="value-line"></path>
					<g class="points"></g>
					<g class="labels"></g>
				</svg>
			</div>
		`

		this.svg = this.shadow.querySelector('svg')!

		// Event listeners for dragging
		this.svg.addEventListener('pointerdown', this.onPointerDown.bind(this))
		this.svg.addEventListener('pointermove', this.onPointerMove.bind(this))
		this.svg.addEventListener('pointerup', this.onPointerUp.bind(this))
		this.svg.addEventListener('pointerleave', this.onPointerUp.bind(this))

		this.updateGraph()
	}

	private updateGraph() {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!this.svg) return

		let scale = $fullScale.get()
		let activeIndex = $activeIndex.get()
		let config = CHANNEL_CONFIGS[this.channel]

		let rect = this.svg.getBoundingClientRect()
		let W = rect.width || 400
		let H = 200
		let { l: PL, r: PR, t: PT, b: PB } = this.PAD
		let plotW = W - PL - PR
		let plotH = H - PT - PB

		// Update viewBox to match actual width
		this.svg.setAttribute('viewBox', `0 0 ${String(W)} ${String(H)}`)

		// Grid lines
		let gridGroup = this.svg.querySelector('.grid')!
		gridGroup.innerHTML = ''
		for (let index = 0; index <= 4; index++) {
			let y = PT + (index / 4) * plotH
			let line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
			line.setAttribute('x1', String(PL))
			line.setAttribute('y1', String(y))
			line.setAttribute('x2', String(W - PR))
			line.setAttribute('y2', String(y))
			line.classList.add('grid-line')
			gridGroup.append(line)
		}

		// Invalid regions (bars for each step)
		let invalidGroup = this.svg.querySelector('.invalid-regions')!
		invalidGroup.innerHTML = ''
		this.renderInvalidRegions(scale, plotW, plotH, PL, PT, config, invalidGroup)

		// Value line path
		let valueLine = this.svg.querySelector<SVGPathElement>('.value-line')
		valueLine!.style.stroke = config.color

		let pathData = scale
			.map((step, index) => {
				let x = PL + (index / (scale.length - 1)) * plotW
				let y = PT + (1 - (step[this.channel] - config.min) / (config.max - config.min)) * plotH
				return `${index === 0 ? 'M' : 'L'} ${String(x)} ${String(y)}`
			})
			.join(' ')
		valueLine!.setAttribute('d', pathData)

		// Points
		let pointsGroup = this.svg.querySelector('.points')!
		pointsGroup.innerHTML = ''

		for (let [index, step] of scale.entries()) {
			let x = PL + (index / (scale.length - 1)) * plotW
			let value = step[this.channel]
			let y = PT + (1 - (value - config.min) / (config.max - config.min)) * plotH
			let isActive = index === activeIndex

			let g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
			g.classList.add('point-group')
			if (isActive) g.classList.add('active')
			g.dataset.index = String(index)

			// Background circle
			let bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
			bgCircle.setAttribute('cx', String(x))
			bgCircle.setAttribute('cy', String(y))
			bgCircle.setAttribute('r', '8')
			bgCircle.classList.add('point-bg')
			g.append(bgCircle)

			// Color circle
			let colorCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
			colorCircle.setAttribute('cx', String(x))
			colorCircle.setAttribute('cy', String(y))
			colorCircle.setAttribute('r', '6')
			colorCircle.setAttribute('fill', step.hex)
			colorCircle.classList.add('point-color')
			g.append(colorCircle)

			// Active ring
			let ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
			ring.setAttribute('cx', String(x))
			ring.setAttribute('cy', String(y))
			ring.setAttribute('r', '10')
			ring.classList.add('point-ring')
			g.append(ring)

			pointsGroup.append(g)
		}

		// Value labels
		let labelsGroup = this.svg.querySelector('.labels')!
		labelsGroup.innerHTML = ''

		for (let [index, step] of scale.entries()) {
			let x = PL + (index / (scale.length - 1)) * plotW
			let value = step[this.channel]
			let isActive = index === activeIndex

			let text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
			text.setAttribute('x', String(x))
			text.setAttribute('y', String(H - 8))
			text.classList.add('value-label')
			if (isActive) text.classList.add('active')
			text.textContent = config.format(value)
			labelsGroup.append(text)
		}
	}

	private renderInvalidRegions(
		scale: FullColorStep[],
		plotW: number,
		plotH: number,
		PL: number,
		PT: number,
		config: (typeof CHANNEL_CONFIGS)[Channel],
		container: Element,
	) {
		let stepsCount = scale.length
		let barWidth = plotW / stepsCount

		for (let [index, step] of scale.entries()) {
			// Get valid ranges for this channel given the other two values
			let validRanges = getValidRangesForChannel(this.channel, step, 'srgb')

			// Convert valid ranges to invalid ranges
			let invalidRanges = this.invertRanges(validRanges, config.min, config.max)

			// Calculate bar position (centered on point)
			let xCenter = PL + (index / (stepsCount - 1)) * plotW
			let xStart = index === 0 ? PL : xCenter - barWidth / 2
			let xEnd = index === stepsCount - 1 ? PL + plotW : xCenter + barWidth / 2
			let width = xEnd - xStart

			// Draw a rect for each invalid range
			for (let [rangeMin, rangeMax] of invalidRanges) {
				// Convert values to y coordinates (inverted: higher values = lower y)
				let yTop = PT + (1 - (rangeMax - config.min) / (config.max - config.min)) * plotH
				let yBottom = PT + (1 - (rangeMin - config.min) / (config.max - config.min)) * plotH
				let height = yBottom - yTop

				if (0 < height) {
					let rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
					rect.setAttribute('x', String(xStart))
					rect.setAttribute('y', String(yTop))
					rect.setAttribute('width', String(width))
					rect.setAttribute('height', String(height))
					rect.classList.add('invalid-region')
					container.append(rect)
				}
			}
		}
	}

	/**
	 * Given an array of valid ranges within [min, max], return the inverse (invalid ranges).
	 */
	private invertRanges(validRanges: ValueRange[], min: number, max: number): ValueRange[] {
		if (validRanges.length === 0) {
			// Everything is invalid
			return [[min, max]]
		}

		// Sort ranges by start
		let sorted = [...validRanges].sort((a, b) => a[0] - b[0])
		let invalid: ValueRange[] = []

		let cursor = min
		for (let [start, end] of sorted) {
			if (cursor < start) {
				invalid.push([cursor, start])
			}

			cursor = Math.max(cursor, end)
		}

		if (cursor < max) {
			invalid.push([cursor, max])
		}

		return invalid
	}

	private getPointIndexAtPosition(clientX: number, clientY: number): number | undefined {
		let scale = $fullScale.get()
		let config = CHANNEL_CONFIGS[this.channel]
		let rect = this.svg.getBoundingClientRect()

		let x = clientX - rect.left
		let y = clientY - rect.top

		let W = rect.width
		let H = 200
		let { l: PL, r: PR, t: PT, b: PB } = this.PAD
		let plotW = W - PL - PR
		let plotH = H - PT - PB

		for (let index = 0; index < scale.length; index++) {
			let px = PL + (index / (scale.length - 1)) * plotW
			let value = scale[index][this.channel]
			let py = PT + (1 - (value - config.min) / (config.max - config.min)) * plotH

			let distance = Math.hypot(x - px, y - py)
			if (distance < 15) return index
		}

		return undefined
	}

	private onPointerDown(event: PointerEvent) {
		let pointIndex = this.getPointIndexAtPosition(event.clientX, event.clientY)
		if (pointIndex !== undefined) {
			this.dragState = { dragging: true, pointIndex }
			this.svg.setPointerCapture(event.pointerId)
			selectSwatch(pointIndex)
			event.preventDefault()
		}
	}

	private onPointerMove(event: PointerEvent) {
		if (!this.dragState.dragging || this.dragState.pointIndex === undefined) {
			// Update cursor based on hover
			let isOverPoint = this.getPointIndexAtPosition(event.clientX, event.clientY) !== undefined
			this.svg.style.cursor = isOverPoint ? 'grab' : 'crosshair'
			return
		}

		this.svg.style.cursor = 'grabbing'

		let rect = this.svg.getBoundingClientRect()
		let y = event.clientY - rect.top
		let config = CHANNEL_CONFIGS[this.channel]
		let H = 200
		let { t: PT, b: PB } = this.PAD
		let plotH = H - PT - PB

		// Convert y to value
		let normalizedY = Math.max(0, Math.min(1, (y - PT) / plotH))
		let value = config.max - normalizedY * (config.max - config.min)
		let clampedValue = Math.max(config.min, Math.min(config.max, value))

		// Clamp to the valid gamut ranges for this channel given the other channel values
		let scale = $fullScale.get()
		let step = scale[this.dragState.pointIndex]
		let validRanges = getValidRangesForChannel(this.channel, step, 'srgb')
		let gamutValue = this.clampToValidRanges(clampedValue, validRanges)

		updateStep(this.dragState.pointIndex, { [this.channel]: gamutValue })
	}

	/**
	 * Snaps a value to the nearest boundary within the union of valid ranges.
	 * If the value already falls within a valid range, it is returned unchanged.
	 */
	private clampToValidRanges(value: number, validRanges: ValueRange[]): number {
		if (validRanges.length === 0) return value

		for (let [start, end] of validRanges) {
			if (start <= value && value <= end) return value
		}

		let nearest = validRanges[0][0]
		let nearestDistance = Math.abs(value - nearest)

		for (let [start, end] of validRanges) {
			for (let boundary of [start, end]) {
				let distance = Math.abs(value - boundary)
				if (distance < nearestDistance) {
					nearestDistance = distance
					nearest = boundary
				}
			}
		}

		return nearest
	}

	private onPointerUp(event: PointerEvent) {
		if (this.dragState.dragging) {
			this.svg.releasePointerCapture(event.pointerId)
			this.dragState = { dragging: false, pointIndex: undefined }
			this.svg.style.cursor = 'crosshair'
		}
	}
}

customElements.define('lch-graph', LchGraph)
