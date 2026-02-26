import { css } from '../../_utilities.js'

/**
 * Register CSS custom properties with `inherits: false` for performance.
 * This prevents style recalculation from cascading to children during
 * high-frequency swipe updates.
 */
export function registerCSSProperties(): void {
	if (typeof CSS === 'undefined' || !('registerProperty' in CSS)) return

	let properties = [
		{ name: '--drawer-offset-y', syntax: '<length>', initial: '0px' },
		{ name: '--drawer-swipe-y', syntax: '<length>', initial: '0px' },
		{ name: '--drawer-backdrop-opacity', syntax: '<number>', initial: '0' },
	]

	for (let { name, syntax, initial } of properties) {
		try {
			CSS.registerProperty({
				name,
				syntax,
				inherits: false,
				initialValue: initial,
			})
		} catch {
			// Already registered or not supported — fine
		}
	}
}

export const DRAWER_STYLES = css`
	:host {
		display: contents;
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 999;
		pointer-events: none;
		background: rgb(0 0 0 / var(--drawer-backdrop-opacity));
		opacity: 0;
		transition: opacity 300ms ease;
		-webkit-tap-highlight-color: transparent;
	}

	:host([open]) .backdrop {
		pointer-events: auto;
		opacity: 1;
	}

	.popup {
		position: fixed;
		inset-block-end: 0;
		inset-inline: 0;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		max-block-size: var(--drawer-max-height, 95vb);
		background: var(--drawer-bg, #fff);
		border-radius: var(--drawer-radius, 12px 12px 0 0);
		box-shadow: var(--drawer-shadow, 0 -4px 24px rgb(0 0 0 / 12%));

		/* Composed transform: snap-point offset + swipe drag offset */
		transform: translateY(calc(100% + var(--drawer-offset-y, 0px) + var(--drawer-swipe-y, 0px)));

		/* Default transition — active during release/snap; disabled during drag */
		transition: transform calc(var(--drawer-swipe-strength, 0.6) * 350ms)
			cubic-bezier(0.32, 0.72, 0, 1);
		will-change: transform;
	}

	/* When open and not swiping: translate to snap offset only */
	:host([open]) .popup {
		transform: translateY(calc(var(--drawer-offset-y, 0px) + var(--drawer-swipe-y, 0px)));
	}

	/* During active swiping, disable CSS transitions for 1:1 finger tracking */
	.popup.swiping {
		/* stylelint-disable-next-line declaration-no-important */
		transition: none !important;
	}

	.handle-area {
		display: flex;
		justify-content: center;
		padding: 12px 0 4px;
		touch-action: none;
		cursor: grab;
		user-select: none;
	}

	.handle-area:active {
		cursor: grabbing;
	}

	.handle-bar {
		inline-size: 36px;
		block-size: 4px;
		background: var(--drawer-handle-color, #d1d5db);
		border-radius: 2px;
	}

	.content {
		flex: 1;
		overflow-block: auto;
		overscroll-behavior-block: contain;
		-webkit-overflow-scrolling: touch;
		touch-action: pan-y;
	}
`
