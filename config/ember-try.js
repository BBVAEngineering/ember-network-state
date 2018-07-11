/* eslint-env node */
'use strict';

module.exports = {
	scenarios: [
		{
			name: 'ember-release',
			bower: {
				dependencies: {
					ember: 'components/ember#release'
				},
				resolutions: {
					ember: 'release'
				}
			},
			npm: {
				devDependencies: {
					'ember-source': null
				}
			}
		},
		{
			name: 'ember-beta',
			bower: {
				dependencies: {
					ember: 'components/ember#beta'
				},
				resolutions: {
					ember: 'beta'
				}
			},
			npm: {
				devDependencies: {
					'ember-source': null
				}
			}
		},
		{
			name: 'ember-canary',
			bower: {
				dependencies: {
					ember: 'components/ember#canary'
				},
				resolutions: {
					ember: 'canary'
				}
			},
			npm: {
				devDependencies: {
					'ember-source': null
				}
			}
		},
		{
			name: 'ember-default',
			npm: {
				devDependencies: {}
			}
		}
	]
};
