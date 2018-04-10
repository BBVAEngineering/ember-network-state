import { computed, getWithDefault, observer } from '@ember/object';
import Evented from '@ember/object/evented';
import Service from '@ember/service';
import { STATES, CONFIG } from '../constants';
import fetch from 'fetch';
import { cancel, later } from '@ember/runloop';
import { getOwner } from '@ember/application';

const { navigator } = window;

export default Service.extend(Evented, {

	/**
	 * Navigator proxy for testing.
	 *
	 * @property navigator
	 * @type {Object}
	 */
	navigator,

	/**
	 * State property. Posible values:
	 *
	 *  * ONLINE
	 *  * OFFLINE
	 *  * RECONNECTING
	 *
	 * @property state
	 * @type {String}
	 */
	state: computed(function() {
		const onLine = this.get('navigator.onLine');

		return onLine ? STATES.ONLINE : STATES.OFFLINE;
	}),

	/**
	 * Check when network is online.
	 *
	 * @property isOnline
	 * @type {Boolean}
	 */
	isOnline: computed.equal('state', STATES.ONLINE),

	/**
	 * Check when network is offline.
	 *
	 * @property isOffline
	 * @type {Boolean}
	 */
	isOffline: computed.equal('state', STATES.OFFLINE),

	/**
	 * Check when network is reconnecting.
	 *
	 * @property isReconnecting
	 * @type {Boolean}
	 */
	isReconnecting: computed.equal('state', STATES.RECONNECTING),

	/**
	 * Remaining time for next reconnect.
	 *
	 * @property remaining
	 * @type {Number}
	 */
	remaining: computed(function() {
		const timestamp = this.get('_timestamp');

		if (!timestamp) {
			return NaN;
		}

		const delta = timestamp - Date.now();

		return delta > 0 ? delta : 0;
	}).volatile(),

	/**
	 * Init window listeners.
	 *
	 * @method init
	 */
	init() {
		this._super(...arguments);

		const appConfig = getOwner(this).resolveRegistration('config:environment');
		const addonConfig = getWithDefault(appConfig, 'network', {});
		const config = Object.assign({}, CONFIG, addonConfig);

		this.set('_config', config);

		const changeNetworkBinding = this.get('_changeNetworkBinding');

		window.addEventListener('online', changeNetworkBinding);
		window.addEventListener('offline', changeNetworkBinding);
	},

	/**
	 * Deinit window listeners.
	 *
	 * @method willDestroy
	 */
	willDestroy() {
		this._super(...arguments);

		const changeNetworkBinding = this.get('_changeNetworkBinding');

		window.removeEventListener('online', changeNetworkBinding);
		window.removeEventListener('offline', changeNetworkBinding);
	},

	/**
	 * Handles network change.
	 *
	 * @method _onChange
	 * @private
	 */
	_onChange: observer('state', function() {
		const state = this.get('state');
		const timer = this.get('_timer');

		if (timer) {
			cancel(timer);

			this.set('_timer');
		}

		this.set('_nextDelay');
		this.set('_timestamp');

		if (state === STATES.RECONNECTING) {
			this._reconnect();
		}

		this.trigger('change', state);
	}),

	/**
	 * Saved timer.
	 *
	 * @property _timer
	 * @type {Number}
	 */
	_timer: null,

	/**
	 * Change network binding.
	 *
	 * @property changeNetworkBinding
	 * @type Function
	 * @private
	 */
	_changeNetworkBinding: computed(function() {
		return this._changeNetwork.bind(this);
	}),

	/**
	 * React to network changes.
	 *
	 * @method _changeNetwork
	 * @private
	 */
	_changeNetwork() {
		const onLine = this.get('navigator.onLine');
		const state = onLine ? STATES.RECONNECTING : STATES.OFFLINE;

		this.set('state', state);
	},

	/**
	 * Check connection.
	 *
	 * @method _reconnect
	 * @private
	 */
	async _reconnect() {
		const { reconnect } = this.get('_config');

		try {
			await fetch(reconnect.path);

			this.set('state', STATES.ONLINE);
		} catch (e) {
			this._delayReconnect();
		}
	},

	/**
	 * Schedule next reconnect.
	 *
	 * @method _delayReconnect
	 * @private
	 */
	_delayReconnect() {
		const { reconnect } = this.get('_config');
		const delay = this.getWithDefault('_nextDelay', reconnect.delay);
		let nextDelay = delay * reconnect.multiplier;

		if (nextDelay > reconnect.max) {
			nextDelay = reconnect.max;
		}

		const timer = later(this, '_reconnect', delay);

		this.setProperties({
			_nextDelay: nextDelay,
			_timestamp: Date.now() + delay,
			_timer: timer
		});
	}

});
