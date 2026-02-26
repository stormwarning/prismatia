/* eslint-disable yoda */
export type SnapPointInput = number | string

export interface ResolvedSnapPoint {
	/** Resolved pixel height of the drawer at this snap */
	height: number
	/** Translation offset from fully open: popupHeight - height */
	offset: number
	/** Original user-provided value */
	value: SnapPointInput
}

/**
 * Convert a single snap point value to a pixel height.
 *  - number in (0, 1]: fraction of viewport height
 *  - number > 1: raw pixels
 *  - string ending in 'px': parsed as pixels
 *  - string ending in 'rem': multiplied by root font size
 */
function resolveValue(
	snap: SnapPointInput,
	viewportHeight: number,
	rootFontSize: number,
): number | undefined {
	if (typeof snap === 'number') {
		if (!Number.isFinite(snap)) return undefined
		if (snap <= 1) return Math.max(0, Math.min(snap, 1)) * viewportHeight
		return snap
	}

	let trimmed = snap.trim()

	if (trimmed.endsWith('px')) {
		let v = Number.parseFloat(trimmed)
		return Number.isFinite(v) ? v : undefined
	}

	if (trimmed.endsWith('rem')) {
		let v = Number.parseFloat(trimmed)
		return Number.isFinite(v) ? v * rootFontSize : undefined
	}

	return undefined
}

/**
 * Resolve an array of snap point inputs into sorted ResolvedSnapPoints.
 * Returns smallest-offset-first (most expanded first).
 */
export function resolveSnapPoints(
	inputs: SnapPointInput[],
	popupHeight: number,
	viewportHeight: number,
	rootFontSize = 16,
): ResolvedSnapPoint[] {
	if (inputs.length === 0 || viewportHeight <= 0 || popupHeight <= 0) return []

	let maxHeight = Math.min(popupHeight, viewportHeight)

	let resolved: ResolvedSnapPoint[] = []

	for (let value of inputs) {
		let h = resolveValue(value, viewportHeight, rootFontSize)
		if (h === undefined || !Number.isFinite(h)) continue

		let clamped = Math.max(0, Math.min(h, maxHeight))
		resolved.push({
			value,
			height: clamped,
			offset: Math.max(0, popupHeight - clamped),
		})
	}

	// Sort by height descending (smallest offset first = most expanded first)
	resolved.sort((a, b) => b.height - a.height)

	// Deduplicate snap points within 1px of each other
	let deduped: ResolvedSnapPoint[] = []
	for (let point of resolved) {
		if (deduped.some((d) => Math.abs(d.height - point.height) <= 1)) continue
		deduped.push(point)
	}

	return deduped
}

/**
 * Find the snap point closest to a given offset value.
 */
export function findClosestSnapPoint(
	targetOffset: number,
	points: ResolvedSnapPoint[],
): ResolvedSnapPoint | undefined {
	let closest: ResolvedSnapPoint | undefined
	let closestDistribution = Infinity

	for (let p of points) {
		let d = Math.abs(p.offset - targetOffset)
		if (d < closestDistribution) {
			closestDistribution = d
			closest = p
		}
	}

	return closest
}

/**
 * For sequential snap mode: find the adjacent snap point in the given direction.
 * direction > 0 means collapsing (increasing offset), < 0 means expanding (decreasing offset).
 */
export function findAdjacentSnapPoint(
	currentOffset: number,
	direction: number,
	points: ResolvedSnapPoint[],
): ResolvedSnapPoint | undefined {
	// Points are sorted by offset ascending (most expanded first)
	let sorted = [...points].sort((a, b) => a.offset - b.offset)

	// Find the current snap point index
	let currentIndex = 0
	let minDistribution = Infinity
	for (let [index, element] of sorted.entries()) {
		let d = Math.abs(element.offset - currentOffset)
		if (d < minDistribution) {
			minDistribution = d
			currentIndex = index
		}
	}

	if (0 < direction && currentIndex < sorted.length - 1) {
		return sorted[currentIndex + 1]
	}

	if (direction < 0 && 0 < currentIndex) {
		return sorted[currentIndex - 1]
	}

	return sorted[currentIndex]
}
