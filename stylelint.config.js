/** @type {import('stylelint').Config} */
const config = {
	extends: ['@zazen/stylelint-config'],
	ignoreFiles: ['**/dist/**/*.css'],
	rules: {
		'custom-property-pattern': [
			'^(_)?([a-z][a-z0-9]*)(-[a-z0-9]+)*$',
			{
				message: (name) => `Expected custom property name "${name}" to be kebab-case`,
			},
		],
	},
	overrides: [
		{
			files: ['**/*.html'],
			customSyntax: 'postcss-html',
		},
		{
			files: ['**/*.ts'],
			customSyntax: 'postcss-lit',
			rules: {
				// eslint-disable-next-line unicorn/no-null
				'value-keyword-case': null,
			},
		},
	],
}

export default config
