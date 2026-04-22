import './styles/reset.css'
import './styles/theme.css'
// Register web components
import './components/f-drawer/f-drawer.js'
import './components/f-select/f-select.js'
import './components/prismatia-logo.js'
import './components/export-dialog.js'
import './components/global-controls.js'
import './components/channel-slider.js'
import './components/color-strip.js'
import './components/swatch-editor.js'
import './components/lch-graph.js'

// Initialize stores (loads from localStorage if available)
import { $activeFullColor } from './stores/scale.js'

$activeFullColor.subscribe((color) => {
	document.body.style.setProperty('--current-color', color?.hex ?? 'transparent')
})

console.info('Prismatia OKLCH Scale Editor initialized')
