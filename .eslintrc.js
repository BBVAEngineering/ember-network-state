/* eslint-env node */
'use strict';

module.exports = {
	root: true,
	parserOptions: {
		ecmaVersion: 2017,
		sourceType: 'module'
	},
	extends: 'eslint-config-bbva',
	env: {
		browser: true
	}
};
