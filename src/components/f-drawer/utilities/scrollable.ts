/* eslint-disable yoda */
/**
 * Check if an element is scrollable along the Y axis.
 */
export function isScrollableY(element: Element): boolean {
	let style = getComputedStyle(element)
	let overflow = style.overflowY
	return (
		(overflow === 'auto' || overflow === 'scroll') && element.clientHeight < element.scrollHeight
	)
}

/**
 * Walk up from `target` to find the first scrollable ancestor
 * that is still contained within `boundary`.
 */
export function findScrollableAncestor(target: Element, boundary: Element): Element | undefined {
	let current: Element | null = target
	while (current && current !== boundary) {
		if (isScrollableY(current)) return current
		current = current.parentElement
	}

	return undefined
}

/**
 * Check if a scrollable element is at its scroll edge in the given direction.
 * direction > 0 = scrolling down (checking bottom edge)
 * direction < 0 = scrolling up (checking top edge)
 */
export function isAtScrollEdge(element: Element, direction: number): boolean {
	if (0 < direction) {
		// At bottom edge (within 1px tolerance)
		return element.scrollHeight - 1 <= element.scrollTop + element.clientHeight
	}

	// At top edge
	return element.scrollTop <= 1
}
