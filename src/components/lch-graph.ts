/* eslint-disable yoda */
import { getValidRangesForChannel, type ValueRange } from '../lib/color.js'
import {
	$activeIndex,
	$fullScale,
	$gamut,
	globalNudge,
	selectSwatch,
	updateStep,
} from '../stores/scale.js'
// eslint-disable-next-line import-x/extensions
import { type Channel, CHANNEL_CONFIGS, type FullColorStep } from '../types'
import { css, html } from './_utilities.js'

const styles = css`
	:host {
		display: block;
	}

	.graph-wrapper {
		/* background: var(--ui-bg-tertiary); */
	}

	.graph-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.graph-title {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-dim);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.graph {
		display: block;
		inline-size: 100%;
		block-size: 200px;
		overflow: visible;
	}

	.grid-line {
		stroke: rgb(255 255 255 / 6%);
		stroke-width: 1;
	}

	.invalid-region {
		fill: rgb(255 255 255 / 8%);
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
		/* stylelint-disable-next-line declaration-property-value-no-unknown */
		r: 7;
	}

	.point-ring {
		opacity: 0;
		fill: none;
		stroke: #fff;
		stroke-width: 2;
	}

	.point-group.active .point-ring {
		opacity: 1;
	}

	.value-label {
		font-family: var(--text-family-mono);
		font-size: 10px;
		text-anchor: middle;
		fill: rgb(255 255 255 / 60%);
	}

	.value-label.active {
		font-weight: 600;
		fill: #fff;
	}

	.graph-actions {
		display: flex;
		gap: 4px;
	}

	.nudge-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		inline-size: 24px;
		block-size: 24px;
		padding: var(--space-xxs);
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		transition: 150ms ease-in;
		transition-property: background, scale;
	}

	.nudge-btn:hover {
		background: var(--grey-300);
	}

	.nudge-btn:active {
		scale: 0.95;
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
			$gamut.subscribe(() => {
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

	private getNudgeButtonsHTML(): string {
		let minusIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>`
		let plusIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`

		let nudgeConfigs: Record<Channel, { maxDelta: number; minDelta: number; title: string }> = {
			L: { minDelta: -0.05, maxDelta: 0.05, title: 'L' },
			C: { minDelta: -0.01, maxDelta: 0.01, title: 'C' },
			H: { minDelta: -5, maxDelta: 5, title: 'H' },
		}

		let config = nudgeConfigs[this.channel]

		return html`
			<button class="nudge-btn" data-channel="${this.channel}" data-delta="${config.minDelta}" title="${config.title} ${config.minDelta}">
				${minusIcon}
			</button>
			<button class="nudge-btn" data-channel="${this.channel}" data-delta="${config.maxDelta}" title="${config.title} ${config.maxDelta}">
				${plusIcon}
			</button>
		`
	}

	private render() {
		let config = CHANNEL_CONFIGS[this.channel]

		this.shadow.innerHTML = html`
			<style>
				${styles}
			</style>
			<div class="graph-wrapper">
				<div class="graph-heading">
					<h4 class="graph-title">${config.label}</h4>
					<div class="graph-actions">
						${this.getNudgeButtonsHTML()}
					</div>
				</div>
				<svg class="graph" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200" preserveAspectRatio="none">
					<defs></defs>
					<g class="grid"></g>
					<g class="invalid-regions"></g>
					<g class="value-line-group"></g>
					<g class="points"></g>
					<g class="labels"></g>
				</svg>
			</div>
		`

		this.svg = this.shadow.querySelector('.graph')!

		// Event listeners for dragging
		this.svg.addEventListener('pointerdown', this.onPointerDown.bind(this))
		this.svg.addEventListener('pointermove', this.onPointerMove.bind(this))
		this.svg.addEventListener('pointerup', this.onPointerUp.bind(this))
		this.svg.addEventListener('pointerleave', this.onPointerUp.bind(this))

		// Nudge buttons
		for (let button of this.shadow.querySelectorAll<HTMLButtonElement>('button.nudge-btn')) {
			button.addEventListener('click', () => {
				let channel = button.dataset.channel as Channel
				let delta = Number.parseFloat(button.dataset.delta ?? '0')
				globalNudge(channel, delta)
			})
		}

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

		// Invalid regions (bars for each step)
		let invalidGroup = this.svg.querySelector('.invalid-regions')!
		invalidGroup.innerHTML = ''
		this.renderInvalidRegions(scale, plotW, plotH, PL, PT, config, invalidGroup)

		// Create gradient definitions for value line segments
		let defs = this.svg.querySelector('defs')
		if (!defs) {
			defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
			this.svg.insertBefore(defs, this.svg.firstChild)
		}

		defs.innerHTML = ''

		// Create individual line segments with gradients
		let valueLineGroup = this.svg.querySelector<SVGGElement>('.value-line-group')
		if (!valueLineGroup) {
			valueLineGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
			valueLineGroup.classList.add('value-line-group')
			this.svg.insertBefore(valueLineGroup, invalidGroup)
		}

		valueLineGroup.innerHTML = ''

		// Create segments between each pair of consecutive points
		for (let index = 0; index < scale.length - 1; index++) {
			let x1 = PL + ((index + 0.5) / scale.length) * plotW
			let y1 =
				PT + (1 - (scale[index][this.channel] - config.min) / (config.max - config.min)) * plotH
			let x2 = PL + ((index + 1.5) / scale.length) * plotW
			let y2 =
				PT + (1 - (scale[index + 1][this.channel] - config.min) / (config.max - config.min)) * plotH

			let color1 = scale[index].hex
			let color2 = scale[index + 1].hex
			let gradientId = `gradient-${String(index)}`

			// Create linear gradient
			let gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient')
			gradient.setAttribute('id', gradientId)
			gradient.setAttribute('x1', String(x1))
			gradient.setAttribute('y1', String(y1))
			gradient.setAttribute('x2', String(x2))
			gradient.setAttribute('y2', String(y2))

			let stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
			stop1.setAttribute('offset', '0%')
			stop1.setAttribute('stop-color', color1)
			gradient.append(stop1)

			let stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
			stop2.setAttribute('offset', '100%')
			stop2.setAttribute('stop-color', color2)
			gradient.append(stop2)

			defs.append(gradient)

			// Create line segment
			let line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
			line.setAttribute('x1', String(x1))
			line.setAttribute('y1', String(y1))
			line.setAttribute('x2', String(x2))
			line.setAttribute('y2', String(y2))
			line.setAttribute('stroke', `url(#${gradientId})`)
			line.setAttribute('stroke-width', '2')
			line.setAttribute('stroke-linecap', 'round')
			line.setAttribute('stroke-linejoin', 'round')
			valueLineGroup.append(line)
		}

		// Points
		let pointsGroup = this.svg.querySelector('.points')!
		pointsGroup.innerHTML = ''

		for (let [index, step] of scale.entries()) {
			let x = PL + ((index + 0.5) / scale.length) * plotW
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
			let x = PL + ((index + 0.5) / scale.length) * plotW
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
		let gamut = $gamut.get()
		let stepsCount = scale.length
		// let barWidth = plotW / stepsCount

		for (let [index, step] of scale.entries()) {
			// Get valid ranges for this channel given the other two values
			let validRanges = getValidRangesForChannel(this.channel, step, gamut)

			// Convert valid ranges to invalid ranges
			let invalidRanges = this.invertRanges(validRanges, config.min, config.max)

			// Calculate bar position (centered on point in equal-width columns)
			let xStart = PL + (index / stepsCount) * plotW
			let xEnd = PL + ((index + 1) / stepsCount) * plotW
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
			let px = PL + ((index + 0.5) / scale.length) * plotW
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
