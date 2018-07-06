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
		const addonConfig = getWithDefault(appConfig, 'network-state', {});
		const reconnect = Object.assign({}, CONFIG.reconnect, addonConfig.reconnect);

		this.set('_config', { reconnect });

		const changeNetworkBinding = this.get('_changeNetworkBinding');

		window.addEventListener('online', changeNetworkBinding);
		window.addEventListener('offline', changeNetworkBinding);
	},

	/**
	 * Force reconnection.
	 *
	 * @method reconnect
	 */
	reconnect() {
		const state = this.get('state');

		if (state !== STATES.RECONNECTING) {
			this.set('state', STATES.RECONNECTING);
		} else {
			this._clearTimer();
			this._reconnect();
		}
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

		this.set('_nextDelay');

		this._clearTimer();

		if (state === STATES.RECONNECTING) {
			this.set('_times', 0);
			this._reconnect();
		}

		this.trigger('change', state);
	}),

	/**
	 * Clear timer for reconnect.
	 *
	 * @method _clearTimer
	 */
	_clearTimer() {
		const timer = this.get('_timer');

		if (timer) {
			cancel(timer);

			this.set('_timer');
		}

		this.set('_timestamp');
	},

	/**
	 * Saved timer.
	 *
	 * @property _timer
	 * @type {Number}
	 */
	_timer: null,

	/**
	 * Retry times.
	 *
	 * @property _times
	 * @type {Number}
	 */
	_times: 0,

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
		const { reconnect } = this.get('_config');
		const onLine = this.get('navigator.onLine');
		let state;

		if (!onLine) {
			state = STATES.OFFLINE;
		} else if (reconnect.auto) {
			state = STATES.RECONNECTING;
		} else {
			state = STATES.LIMITED;
		}

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
			this.incrementProperty('_times');
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
		const times = this.get('_times');
		let nextDelay = delay * reconnect.multiplier;

		if (times > reconnect.maxTimes) {
			this.set('state', STATES.LIMITED);
			return;
		}

		if (nextDelay > reconnect.maxDelay) {
			nextDelay = reconnect.maxDelay;
		}

		const timer = later(this, '_reconnect', delay);

		this.setProperties({
			_nextDelay: nextDelay,
			_timestamp: Date.now() + delay,
			_timer: timer
		});
	}

});
