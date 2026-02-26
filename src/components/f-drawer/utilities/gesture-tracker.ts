export interface GestureState {
	/** Current drag offset in pixels from start */
	deltaX: number
	deltaY: number
	/** Whether the gesture has been direction-locked */
	locked: boolean
	/** Overall velocity from start to current in px/ms */
	overallVelocityX: number
	overallVelocityY: number
	/** Instantaneous velocity in px/ms */
	velocityX: number
	velocityY: number
	/** Locked axis: 'x' | 'y' */
	axis?: 'x' | 'y'
}

export interface GestureCallbacks {
	onCancel?: () => void
	onEnd?: (state: GestureState, event: PointerEvent | TouchEvent) => void
	onMove?: (state: GestureState, event: PointerEvent | TouchEvent) => void
	onStart?: (event: PointerEvent | TouchEvent) => void
	/** Return false to prevent the gesture from starting (e.g. target is in a scrollable) */
	shouldStart?: (event: PointerEvent | TouchEvent) => boolean
}

const LOCK_THRESHOLD = 6 // px before direction is locked
const MAX_RELEASE_VELOCITY_AGE_MS = 80
const MIN_SAMPLE_DT_MS = 16

interface DragSample {
	time: number
	x: number
	y: number
}

/**
 * Lightweight pointer/touch gesture tracker.
 *
 * Attaches to an element and reports drag deltas + velocity.
 * Uses pointer events for mouse/pen input and touch events for touch input
 * (matching Base UI's strategy of separating the two to avoid double-firing).
 */
export class GestureTracker {
	private el: HTMLElement
	private cb: GestureCallbacks
	private active = false
	private pointerId: number | undefined = undefined
	private startX = 0
	private startY = 0
	private startTime = 0
	private lastSample: DragSample | undefined = undefined
	private velocity = { x: 0, y: 0 }
	private axis: 'x' | 'y' | undefined = undefined
	private locked = false
	private isTouchInput = false
	// Bound handlers for cleanup
	private _onPointerDown: (event: PointerEvent) => void
	private _onPointerMove: (event: PointerEvent) => void
	private _onPointerUp: (event: PointerEvent) => void
	private _onPointerCancel: (event: PointerEvent) => void
	private _onTouchStart: (event: TouchEvent) => void
	private _onTouchMove: (event: TouchEvent) => void
	private _onTouchEnd: (event: TouchEvent) => void
	private _onTouchCancel: (event: TouchEvent) => void

	constructor(element: HTMLElement, callbacks: GestureCallbacks) {
		this.el = element
		this.cb = callbacks

		this._onPointerDown = this.onPointerDown.bind(this)
		this._onPointerMove = this.onPointerMove.bind(this)
		this._onPointerUp = this.onPointerUp.bind(this)
		this._onPointerCancel = this.onPointerCancel.bind(this)
		this._onTouchStart = this.onTouchStart.bind(this)
		this._onTouchMove = this.onTouchMove.bind(this)
		this._onTouchEnd = this.onTouchEnd.bind(this)
		this._onTouchCancel = this.onTouchCancel.bind(this)

		element.addEventListener('pointerdown', this._onPointerDown)
		element.addEventListener('pointermove', this._onPointerMove)
		element.addEventListener('pointerup', this._onPointerUp)
		element.addEventListener('pointercancel', this._onPointerCancel)
		element.addEventListener('touchstart', this._onTouchStart, { passive: false })
		element.addEventListener('touchmove', this._onTouchMove, { passive: false })
		element.addEventListener('touchend', this._onTouchEnd, { passive: false })
		element.addEventListener('touchcancel', this._onTouchCancel, { passive: false })
	}

	destroy(): void {
		this.el.removeEventListener('pointerdown', this._onPointerDown)
		this.el.removeEventListener('pointermove', this._onPointerMove)
		this.el.removeEventListener('pointerup', this._onPointerUp)
		this.el.removeEventListener('pointercancel', this._onPointerCancel)
		this.el.removeEventListener('touchstart', this._onTouchStart)
		this.el.removeEventListener('touchmove', this._onTouchMove)
		this.el.removeEventListener('touchend', this._onTouchEnd)
		this.el.removeEventListener('touchcancel', this._onTouchCancel)
	}

	// ── Pointer events (mouse + pen only; touch is handled by touch events) ──

	private onPointerDown(event: PointerEvent): void {
		if (event.pointerType === 'touch') return // handled by touch events
		if (event.button !== 0) return
		if (this.cb.shouldStart && !this.cb.shouldStart(event)) return

		this.startGesture(event.clientX, event.clientY, event.timeStamp)
		this.pointerId = event.pointerId
		this.isTouchInput = false
		this.el.setPointerCapture(event.pointerId)
		this.cb.onStart?.(event)
	}

	private onPointerMove(event: PointerEvent): void {
		if (!this.active || this.isTouchInput) return
		if (this.pointerId !== undefined && event.pointerId !== this.pointerId) return
		this.moveGesture(event.clientX, event.clientY, event.timeStamp)
		this.cb.onMove?.(this.buildState(), event)
	}

	private onPointerUp(event: PointerEvent): void {
		if (!this.active || this.isTouchInput) return
		if (this.pointerId !== undefined && event.pointerId !== this.pointerId) return
		this.finalizeVelocity(event.timeStamp)
		this.cb.onEnd?.(this.buildState(), event)
		this.reset()
	}

	private onPointerCancel(_event: PointerEvent): void {
		if (!this.active || this.isTouchInput) return
		this.cb.onCancel?.()
		this.reset()
	}

	// ── Touch events ──

	private onTouchStart(event: TouchEvent): void {
		if (event.touches.length !== 1) return
		if (this.cb.shouldStart && !this.cb.shouldStart(event)) return

		let t = event.touches[0]
		this.startGesture(t.clientX, t.clientY, event.timeStamp)
		this.isTouchInput = true
		this.cb.onStart?.(event)
	}

	private onTouchMove(event: TouchEvent): void {
		if (!this.active || !this.isTouchInput) return
		let t = event.touches[0]
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!t) return

		this.moveGesture(t.clientX, t.clientY, event.timeStamp)
		let state = this.buildState()
		this.cb.onMove?.(state, event)

		// Prevent scrolling once we've locked onto vertical drag
		if (this.locked && this.axis === 'y') {
			event.preventDefault()
		}
	}

	private onTouchEnd(event: TouchEvent): void {
		if (!this.active || !this.isTouchInput) return
		this.finalizeVelocity(event.timeStamp)
		this.cb.onEnd?.(this.buildState(), event)
		this.reset()
	}

	private onTouchCancel(_event: TouchEvent): void {
		if (!this.active || !this.isTouchInput) return
		this.cb.onCancel?.()
		this.reset()
	}

	// ── Core tracking ──

	private startGesture(x: number, y: number, time: number): void {
		this.active = true
		this.startX = x
		this.startY = y
		this.startTime = time
		this.lastSample = { x: 0, y: 0, time }
		this.velocity = { x: 0, y: 0 }
		this.axis = undefined
		this.locked = false
	}

	private moveGesture(x: number, y: number, time: number): void {
		let dx = x - this.startX
		let dy = y - this.startY

		// Direction lock
		if (!this.locked) {
			let absDx = Math.abs(dx)
			let absDy = Math.abs(dy)
			if (LOCK_THRESHOLD <= absDx || LOCK_THRESHOLD <= absDy) {
				this.locked = true
				this.axis = absDx <= absDy ? 'y' : 'x'
			}
		}

		// Record velocity sample
		if (this.lastSample && this.lastSample.time < time) {
			let dt = Math.max(time - this.lastSample.time, MIN_SAMPLE_DT_MS)
			this.velocity = {
				x: (dx - this.lastSample.x) / dt,
				y: (dy - this.lastSample.y) / dt,
			}
		}

		this.lastSample = { x: dx, y: dy, time }
	}

	private finalizeVelocity(endTime: number): void {
		// Zero out velocity if the last sample is too old (user paused before releasing)
		if (this.lastSample && MAX_RELEASE_VELOCITY_AGE_MS < endTime - this.lastSample.time) {
			this.velocity = { x: 0, y: 0 }
		}
	}

	private buildState(): GestureState {
		let dx = this.lastSample?.x ?? 0
		let dy = this.lastSample?.y ?? 0
		let elapsed = Math.max((this.lastSample?.time ?? this.startTime) - this.startTime, 1)

		return {
			deltaX: dx,
			deltaY: dy,
			velocityX: this.velocity.x,
			velocityY: this.velocity.y,
			overallVelocityX: dx / elapsed,
			overallVelocityY: dy / elapsed,
			locked: this.locked,
			axis: this.axis,
		}
	}

	private reset(): void {
		this.active = false
		this.pointerId = undefined
		this.lastSample = undefined
		this.velocity = { x: 0, y: 0 }
		this.axis = undefined
		this.locked = false
		this.isTouchInput = false
	}
}
