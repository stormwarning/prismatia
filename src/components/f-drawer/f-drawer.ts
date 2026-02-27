/* eslint-disable yoda */
import { type GestureState, GestureTracker } from './utilities/gesture-tracker.js'
import { findScrollableAncestor, isAtScrollEdge } from './utilities/scrollable.js'
import {
	findAdjacentSnapPoint,
	findClosestSnapPoint,
	type ResolvedSnapPoint,
	resolveSnapPoints,
	type SnapPointInput,
} from './utilities/snap-points.js'
import { DRAWER_STYLES, registerCSSProperties } from './utilities/styles.js'

// ── Constants (matching Base UI's tuned values) ──

/** Velocity (px/ms) above which a fast swipe always dismisses */
const FAST_SWIPE_VELOCITY = 0.5
/** Velocity threshold to force snap to next point */
const SNAP_VELOCITY_THRESHOLD = 0.5
/** Multiplier for velocity-projected offset */
const SNAP_VELOCITY_MULTIPLIER = 300
/** Min/max for swipe release animation scalar */
const MIN_SWIPE_RELEASE_VELOCITY = 0.2
const MAX_SWIPE_RELEASE_VELOCITY = 4
const MIN_SWIPE_RELEASE_DURATION_MS = 80
const MAX_SWIPE_RELEASE_DURATION_MS = 360

registerCSSProperties()

export interface DrawerOptions {
	/** Start at this snap point index when opening (default: 0, the most expanded) */
	defaultSnapIndex?: number
	/** Minimum drag displacement (px) before a non-fast swipe can dismiss */
	dismissThreshold?: number
	/** Whether the drawer is modal (blocks interaction with the rest of the page) */
	modal?: boolean
	/** Called when the drawer closes */
	onClose?: () => void
	/** Called when open state changes */
	onOpenChange?: (open: boolean) => void
	/** Called when the active snap point changes */
	onSnapChange?: (snapPoint: ResolvedSnapPoint, index: number) => void
	/** Only allow snapping to the immediately adjacent point */
	sequential?: boolean
	snapPoints?: SnapPointInput[]
}

export class Drawer extends HTMLElement {
	// ── Shadow DOM elements ──
	private dialog!: HTMLDialogElement
	private popup!: HTMLDivElement
	private handleArea!: HTMLDivElement
	private contentEl!: HTMLDivElement
	// ── Gesture tracker ──
	private gesture: GestureTracker | undefined = undefined
	// ── State ──
	private _open = false
	private _modal = false
	private _snapPoints: SnapPointInput[] = []
	private _resolvedSnaps: ResolvedSnapPoint[] = []
	private _activeSnapIndex = 0
	private _sequential = false
	private _dismissThreshold = 100
	private _popupHeight = 0

	/** Exposed for external consumers to query */
	get swiping(): boolean {
		return this._swiping
	}

	private _swiping = false
	private _resizeObserver: ResizeObserver | undefined = undefined
	private _snapStartOffset = 0 // offset of the snap point where the gesture started
	// ── Callbacks ──
	onClose?: () => void
	onSnapChange?: (snapPoint: ResolvedSnapPoint, index: number) => void
	onOpenChange?: (open: boolean) => void

	// ── Observed attributes ──
	static get observedAttributes(): string[] {
		return ['open', 'snap-points']
	}

	constructor() {
		super()
		let shadow = this.attachShadow({ mode: 'open' })

		let style = document.createElement('style')
		style.textContent = DRAWER_STYLES

		this.dialog = document.createElement('dialog')
		// this.dialog.setAttribute('role', 'dialog')
		// this.dialog.setAttribute('aria-modal', 'true')

		this.popup = document.createElement('div')
		this.popup.className = 'popup'

		this.handleArea = document.createElement('div')
		this.handleArea.className = 'handle-area'
		let handleBar = document.createElement('div')
		handleBar.className = 'handle-bar'
		this.handleArea.append(handleBar)

		this.contentEl = document.createElement('div')
		this.contentEl.className = 'content'
		let slot = document.createElement('slot')
		this.contentEl.append(slot)

		this.popup.append(this.handleArea)
		this.popup.append(this.contentEl)

		this.dialog.append(this.popup)

		shadow.append(style)
		shadow.append(this.dialog)
	}

	// ── Lifecycle ──

	connectedCallback(): void {
		this.dialog.addEventListener('cancel', this._onDialogCancel)
		this.addEventListener('keydown', this._onKeyDown)

		// Observe popup height for snap point resolution
		this._resizeObserver = new ResizeObserver(() => {
			this._measureAndResolve()
		})
		this._resizeObserver.observe(this.popup)

		this._setupGesture()
	}

	disconnectedCallback(): void {
		this.dialog.removeEventListener('cancel', this._onDialogCancel)
		this.removeEventListener('keydown', this._onKeyDown)
		this.gesture?.destroy()
		this.gesture = undefined
		this._resizeObserver?.disconnect()
		this._resizeObserver = undefined
	}

	attributeChangedCallback(name: string, _old: string | null, value?: string): void {
		if (name === 'open') {
			let isOpen = value !== undefined
			if (isOpen !== this._open) {
				if (isOpen) this.show()
				else this.hide()
			}
		}

		if (name === 'snap-points' && value) {
			this.snapPoints = value.split(',').map((s) => {
				let trimmed = s.trim()
				let n = Number(trimmed)
				return Number.isFinite(n) ? n : trimmed
			})
		}
	}

	// ── Public API ──

	configure(options: DrawerOptions): void {
		if (options.snapPoints) this._snapPoints = options.snapPoints
		if (options.defaultSnapIndex !== undefined) this._activeSnapIndex = options.defaultSnapIndex
		if (options.sequential !== undefined) this._sequential = options.sequential
		if (options.dismissThreshold !== undefined) this._dismissThreshold = options.dismissThreshold
		if (options.modal !== undefined) this._modal = options.modal
		if (options.onClose) this.onClose = options.onClose
		if (options.onSnapChange) this.onSnapChange = options.onSnapChange
		if (options.onOpenChange) this.onOpenChange = options.onOpenChange
		this._measureAndResolve()
	}

	get open(): boolean {
		return this._open
	}

	set open(value: boolean) {
		if (value) this.show()
		else this.hide()
	}

	get snapPoints(): SnapPointInput[] {
		return this._snapPoints
	}

	set snapPoints(value: SnapPointInput[]) {
		this._snapPoints = value
		this._measureAndResolve()
		if (this._open) this._applySnapOffset()
	}

	get activeSnapIndex(): number {
		return this._activeSnapIndex
	}

	/** Programmatically snap to a specific snap point index */
	snapTo(index: number): void {
		if (index < 0 || this._resolvedSnaps.length <= index) return
		this._activeSnapIndex = index
		this._applySnapOffset()
		this.onSnapChange?.(this._resolvedSnaps[index], index)
		this._updateBackdropOpacity()
	}

	show(): void {
		if (this._open) return
		this._open = true

		// Set the initial snap index if we have snap points
		if (this._resolvedSnaps.length === 0) {
			this._measureAndResolve()
		}

		// Default to first (most expanded) snap point
		if (this._resolvedSnaps.length <= this._activeSnapIndex) {
			this._activeSnapIndex = 0
		}

		this.setAttribute('open', '')

		// Use showModal for modal drawers, show for non-modal
		if (this._modal) {
			this.dialog.showModal()
		} else {
			this.dialog.show()
		}

		this._applySnapOffset()
		this._updateBackdropOpacity()
		this.onOpenChange?.(true)

		this.dispatchEvent(new CustomEvent('drawer-open', { bubbles: true }))
	}

	hide(): void {
		if (!this._open) return
		this._open = false
		this.removeAttribute('open')

		// Close the dialog
		this.dialog.close()

		// Reset CSS vars
		this.popup.style.setProperty('--drawer-offset-y', '0px')
		this.popup.style.setProperty('--drawer-swipe-y', '0px')
		this.popup.style.setProperty('--drawer-swipe-strength', '0.6')
		this.style.setProperty('--drawer-backdrop-opacity', '0')

		this.onClose?.()
		this.onOpenChange?.(false)
		this.dispatchEvent(new CustomEvent('drawer-close', { bubbles: true }))
	}

	// ── Internal: measurement and snap resolution ──

	private _measureAndResolve(): void {
		this._popupHeight = this.popup.offsetHeight || 400
		let viewportHeight = window.innerHeight
		let rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

		// eslint-disable-next-line etc/prefer-less-than
		if (this._snapPoints.length > 0) {
			this._resolvedSnaps = resolveSnapPoints(
				this._snapPoints,
				this._popupHeight,
				viewportHeight,
				rootFontSize,
			)
		} else {
			// No snap points = single snap at full height
			this._resolvedSnaps = [{ value: 1, height: this._popupHeight, offset: 0 }]
		}
	}

	private _applySnapOffset(): void {
		let snap = this._resolvedSnaps[this._activeSnapIndex]
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!snap) return
		this.popup.style.setProperty('--drawer-offset-y', `${String(snap.offset)}px`)
	}

	private _updateBackdropOpacity(): void {
		if (!this._open) {
			this.dialog.style.setProperty('--drawer-backdrop-opacity', '0')
			return
		}

		// Compute opacity based on how expanded the drawer is
		let snap = this._resolvedSnaps[this._activeSnapIndex]
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		if (!snap || this._popupHeight <= 0) {
			this.dialog.style.setProperty('--drawer-backdrop-opacity', '0.5')
			return
		}

		// opacity = visible_height / popup_height, clamped [0, 0.5]
		let visibleFraction = (this._popupHeight - snap.offset) / this._popupHeight
		let opacity = Math.min(0.5, Math.max(0, visibleFraction * 0.5))
		this.dialog.style.setProperty('--drawer-backdrop-opacity', String(opacity))
	}

	// ── Internal: gesture handling ──

	private _setupGesture(): void {
		this.gesture = new GestureTracker(this.popup, {
			shouldStart: (event: PointerEvent | TouchEvent) => {
				if (!this._open) return false

				// Determine the event target
				let target = (
					'composedPath' in event ? event.composedPath()[0] : (event as PointerEvent).target
				) as Element | null
				if (!target) return true

				// If the target is inside a scrollable area that isn't at its edge, don't start
				let scrollable = findScrollableAncestor(target, this.popup)
				if (scrollable) {
					// Allow gesture only if at top scroll edge (for pull-down-to-dismiss)
					return isAtScrollEdge(scrollable, -1)
				}

				return true
			},

			onStart: () => {
				this._swiping = true
				this.popup.classList.add('swiping')
				// Remember the snap offset when the gesture started
				let snap = this._resolvedSnaps[this._activeSnapIndex]
				this._snapStartOffset = snap.offset || 0
			},

			onMove: (state: GestureState) => {
				// Only react to vertical movement
				if (state.locked && state.axis !== 'y') {
					return
				}

				let dy = state.deltaY

				// Apply square-root damping for upward drag past the most expanded snap point
				let currentOffset = this._snapStartOffset + dy
				let minOffset = this._resolvedSnaps[0]?.offset ?? 0

				if (currentOffset < minOffset) {
					// Dragging above most-expanded position — damp it
					let overshoot = minOffset - currentOffset
					let damped = -Math.sqrt(overshoot)
					dy = minOffset - this._snapStartOffset + damped
				}

				this.popup.style.setProperty('--drawer-swipe-y', `${String(dy)}px`)

				// Update backdrop opacity during swipe
				let effectiveOffset = Math.max(0, this._snapStartOffset + dy)
				let visibleHeight = this._popupHeight - effectiveOffset
				let fraction = Math.max(0, visibleHeight / this._popupHeight)
				this.dialog.style.setProperty(
					'--drawer-backdrop-opacity',
					String(Math.min(0.5, fraction * 0.5)),
				)
			},

			onEnd: (state: GestureState) => {
				this._swiping = false
				this.popup.classList.remove('swiping')

				// Compute the release velocity and projected position
				let velocity = state.velocityY // px/ms, positive = downward
				let dy = state.deltaY
				let dragOffset = this._snapStartOffset + dy

				// Determine swipe strength for CSS transition duration scaling
				let absVelocity = Math.abs(velocity)
				let strength = this._computeSwipeStrength(absVelocity, dragOffset)
				this.popup.style.setProperty('--drawer-swipe-strength', String(strength))

				// Fast downward swipe = always dismiss
				if (FAST_SWIPE_VELOCITY < velocity) {
					this._resetSwipeY()
					this.hide()
					return
				}

				// Check if dragged past dismiss threshold
				if (this._dismissThreshold < dy && 0 <= velocity) {
					this._resetSwipeY()
					this.hide()
					return
				}

				// Find the target snap point
				let target = this._resolveSnapTarget(dragOffset, velocity)

				if (!target) {
					// Close the drawer if no valid snap target
					this._resetSwipeY()
					this.hide()
					return
				}

				// Find the index of the target snap
				let targetIndex = this._resolvedSnaps.indexOf(target)
				if (0 <= targetIndex) {
					this._activeSnapIndex = targetIndex
				}

				// Animate to the snap point by updating CSS vars and letting CSS transition run
				this._resetSwipeY()
				this._applySnapOffset()
				this._updateBackdropOpacity()

				if (0 <= targetIndex) {
					this.onSnapChange?.(target, targetIndex)
					this.dispatchEvent(
						new CustomEvent('drawer-snap', {
							bubbles: true,
							detail: { snapPoint: target, index: targetIndex },
						}),
					)
				}
			},

			onCancel: () => {
				this._swiping = false
				this.popup.classList.remove('swiping')
				this._resetSwipeY()
				this._applySnapOffset()
			},
		})
	}

	private _resolveSnapTarget(dragOffset: number, velocity: number): ResolvedSnapPoint | undefined {
		if (this._resolvedSnaps.length === 0) return undefined

		if (this._sequential) {
			// Sequential mode: only adjacent snap points
			let direction =
				SNAP_VELOCITY_THRESHOLD < velocity ? 1 : velocity < -SNAP_VELOCITY_THRESHOLD ? -1 : 0
			if (direction !== 0) {
				return findAdjacentSnapPoint(this._snapStartOffset, direction, this._resolvedSnaps)
			}

			return findClosestSnapPoint(dragOffset, this._resolvedSnaps)
		}

		// Free mode: velocity-projected offset
		let velocityOffset =
			clamp(velocity, -MAX_SWIPE_RELEASE_VELOCITY, MAX_SWIPE_RELEASE_VELOCITY) *
			SNAP_VELOCITY_MULTIPLIER
		let projectedOffset = clamp(dragOffset + velocityOffset, 0, this._popupHeight)

		// Check if close position is closer than any snap point
		let closeDistance = Math.abs(this._popupHeight - projectedOffset)
		let closestSnap = findClosestSnapPoint(projectedOffset, this._resolvedSnaps)

		if (!closestSnap) return undefined

		let snapDistance = Math.abs(closestSnap.offset - projectedOffset)
		if (closeDistance < snapDistance) {
			return undefined // signals "close"
		}

		return closestSnap
	}

	private _computeSwipeStrength(absVelocity: number, currentOffset: number): number {
		// Compute the remaining distance to the nearest snap/close position
		let closestSnap = findClosestSnapPoint(currentOffset, this._resolvedSnaps)
		let targetOffset = closestSnap?.offset ?? this._popupHeight
		let remaining = Math.abs(targetOffset - currentOffset)

		if (remaining < 1 || absVelocity < 0.001) return 0.6 // default

		let v = clamp(absVelocity, MIN_SWIPE_RELEASE_VELOCITY, MAX_SWIPE_RELEASE_VELOCITY)
		let durationMs = clamp(
			remaining / v,
			MIN_SWIPE_RELEASE_DURATION_MS,
			MAX_SWIPE_RELEASE_DURATION_MS,
		)
		let normalized =
			(durationMs - MIN_SWIPE_RELEASE_DURATION_MS) /
			(MAX_SWIPE_RELEASE_DURATION_MS - MIN_SWIPE_RELEASE_DURATION_MS)
		return clamp(0.1 + normalized * 0.9, 0.1, 1)
	}

	private _resetSwipeY(): void {
		this.popup.style.setProperty('--drawer-swipe-y', '0px')
	}

	// ── Event handlers ──

	private _onDialogCancel = (): void => {
		this.hide()
	}
	private _onKeyDown = (event: Event): void => {
		if ((event as KeyboardEvent).key === 'Escape' && this._open) {
			this.hide()
		}
	}
}

// ── Utility ──

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(value, max))
}

// ── Register the custom element ──

customElements.define('f-drawer', Drawer)
