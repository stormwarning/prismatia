import zazen from '@zazen/eslint-config'
import zazenStylistic from '@zazen/eslint-config/stylistic'
import zazenTypeScript from '@zazen/eslint-config/typescript'
import { defineConfig } from 'eslint/config'
import globals from 'globals'

const config = defineConfig([
	{
		name: 'project/ignores',
		ignores: ['**/dist'],
	},

	...zazen,
	...zazenTypeScript,

	{
		name: 'project/rules',
		files: ['**/*.ts'],
		rules: {
			/** @todo [@zazen/eslint-config@>7.4.1] Disable this rule upstream. */
			'@stylistic/curly-newline': 'off',
		},
	},

	{
		name: 'project/rules/components',
		files: ['**/components/*.ts'],
		languageOptions: {
			globals: {
				...globals.browser,
			},
		},
		rules: {},
	},

	{
		name: 'project/rules/configs',
		files: ['**/*.config.?(j|t)s'],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
		rules: {
			'import-x/no-extraneous-dependencies': 'off',
		},
	},

	zazenStylistic,
])

export default config
