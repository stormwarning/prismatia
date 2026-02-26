import './styles/reset.css'
import './styles/theme.css'
// Register web components
import './components/f-drawer/f-drawer.js'
import './components/prismatia-logo.js'
import './components/global-controls.js'
import './components/channel-slider.js'
import './components/color-strip.js'
import './components/swatch-editor.js'
import './components/lch-graph.js'
// Initialize stores (loads from localStorage if available)
import './stores/scale.js'

// eslint-disable-next-line no-undef
console.info('Prismatia OKLCH Scale Editor initialized')
