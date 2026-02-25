/** @type {import('stylelint').Config} */
const config = {
	extends: ['@zazen/stylelint-config'],
	ignoreFiles: ['**/dist'],
	rules: {
		/* … */
	},
	overrides: [
		{
			files: ['**/*.html'],
			customSyntax: 'postcss-html',
		},
		{
			files: ['**/*.ts'],
			customSyntax: 'postcss-lit',
		},
	],
}

export default config
