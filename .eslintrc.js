'use strict';

module.exports = {
	root: true,
	parser: 'babel-eslint',
	parserOptions: {
		ecmaVersion: 2018,
		sourceType: 'module',
		ecmaFeatures: {
			legacyDecorators: true,
		},
	},
	plugins: ['ember'],
	extends: [
		'eslint:recommended',
		'plugin:ember/recommended',
		'plugin:prettier/recommended',
	],
	env: {
		browser: true,
	},
	rules: {
		'ember/no-computed-properties-in-native-classes': 'off',
		'ember/classic-decorator-hooks': 'off',
	},
	overrides: [
		// node files
		{
			files: [
				'.huskyrc.js',
				'.commitlintrc.js',
				'.eslintrc.js',
				'.prettierrc.js',
				'.template-lintrc.js',
				'ember-cli-build.js',
				'index.js',
				'testem.js',
				'blueprints/*/index.js',
				'config/**/*.js',
				'tests/dummy/config/**/*.js',
			],
			excludedFiles: [
				'addon/**',
				'addon-test-support/**',
				'app/**',
				'tests/dummy/app/**',
			],
			parserOptions: {
				sourceType: 'script',
			},
			env: {
				browser: false,
				node: true,
			},
			plugins: ['node'],
			extends: ['plugin:node/recommended'],
		},
		{
			// Test files:
			files: ['tests/**/*-test.{js,ts}'],
			extends: ['plugin:qunit/recommended'],
			rules: {
				'qunit/require-expect': 'off',
			},
		},
	],
};
