import { computed } from '@ember/object';
import Evented from '@ember/object/evented';
import Service from '@ember/service';
import { STATES, CONFIG } from '../constants';
import fetch, { AbortController } from 'fetch';
import { cancel, later } from '@ember/runloop';
import { getOwner } from '@ember/application';
import { equal, notEmpty, readOnly } from '@ember/object/computed';
import { A } from '@ember/array';

export default class NetworkService extends Service.extend(Evented) {
	lastReconnectDuration = 0;
	lastReconnectStatus = 0;

	_timer = null;
	_times = 0;
	_state = null;
	_controllers = null;

	@readOnly('_state') state;
	@equal('_state', STATES.ONLINE) isOnline;
	@equal('_state', STATES.OFFLINE) isOffline;
	@equal('_state', STATES.LIMITED) isLimited;
	@notEmpty('_controllers') isReconnecting;
	@notEmpty('_timer') hasTimer;

	get remaining() {
		const timestamp = this._timestamp;

		if (!timestamp) {
			return NaN;
		}

		const delta = timestamp - Date.now();

		return delta > 0 ? delta : 0;
	}

	reconnect() {
		this._clearTimer();
		this._reconnect();
	}

	setState(state) {
		if (state !== this._state) {
			this._clearTimer();

			this.set('_state', state);

			this.trigger('change', state);
		}
	}

	init() {
		super.init(...arguments);

		const connection = this._connection;
		const appConfig = getOwner(this).resolveRegistration('config:environment');
		const addonConfig = appConfig['network-state'] || {};
		const reconnect = Object.assign({}, CONFIG.reconnect, addonConfig.reconnect);

		this.set('_controllers', A());
		this.set('_config', { reconnect });

		const changeNetworkBinding = this._changeNetworkBinding;

		if (connection) {
			connection.addEventListener('change', changeNetworkBinding);
		} else {
			window.addEventListener('online', changeNetworkBinding);
			window.addEventListener('offline', changeNetworkBinding);
		}

		const onLine = window.navigator.onLine;

		this.setState(onLine ? STATES.ONLINE : STATES.OFFLINE);

		if (onLine) {
			this.reconnect();
		}
	}

	willDestroy() {
		super.willDestroy(...arguments);

		const connection = this._connection;
		const changeNetworkBinding = this._changeNetworkBinding;

		window.removeEventListener('online', changeNetworkBinding);
		window.removeEventListener('offline', changeNetworkBinding);

		if (connection) {
			connection.removeEventListener('change', changeNetworkBinding);
		}
	}

	get _connection() {
		return window.navigator.connection || window.navigator.mozConnection || window.navigator.webkitConnection;
	}

	_clearTimer() {
		const timer = this._timer;

		if (timer) {
			cancel(timer);
			this.set('_timer');
		}

		this.set('_nextDelay');
		this.set('_times', 0);
		this.set('_timestamp');
	}

	@computed('_changeNetwork')
	get _changeNetworkBinding() {
		return this._changeNetwork.bind(this);
	}

	_changeNetwork() {
		const onLine = window.navigator.onLine;

		/* istanbul ignore else */
		if (this._connection) {
			this.trigger('connection-change', this._connection);
		}

		if (!onLine) {
			this.setState(STATES.OFFLINE);
		} else {
			this.reconnect();
		}
	}

	async _reconnect() {
		const { reconnect } = this._config;
		const controller = new AbortController();

		// Cancel all ongoing controllers.
		this._abortControllers();
		// Push new controller.
		this._controllers.pushObject(controller);

		const timeout = later(controller, 'abort', reconnect.timeout);
		const start = performance.now();
		let status = 0;

		try {
			const response = await fetch(reconnect.path, {
				method: 'HEAD',
				cache: 'no-store',
				signal: controller.signal,
				headers: { 'cache-control': 'no-cache' }
			});

			if (!this.isDestroyed) {
				this._controllers.removeObject(controller);

				status = response.status;

				this.setState(STATES.ONLINE);
			}
		} catch (e) {
			this._controllers.removeObject(controller);

			if (!this.isDestroyed && !this.isReconnecting) {
				this._handleError();
			}
		} finally {
			cancel(timeout);

			if (!this.isDestroyed && !this.isReconnecting) {
				this.setProperties({
					lastReconnectStatus: status,
					lastReconnectDuration: performance.now() - start
				});
			}
		}
	}

	_abortControllers() {
		const controllers = this._controllers;

		controllers.forEach((controller) => {
			controller.abort();
		});

		controllers.clear();
	}

	_handleError() {
		const { reconnect } = this._config;
		const onLine = window.navigator.onLine;

		if (onLine) {
			this.setState(STATES.LIMITED);

			if (reconnect.auto) {
				this.incrementProperty('_times');
				this._delayReconnect();
			}
		} else {
			this.setState(STATES.OFFLINE);
		}
	}

	_delayReconnect() {
		const { reconnect } = this._config;
		const delay = (this._nextDelay === undefined ? reconnect.delay : this._nextDelay);
		const times = this._times;
		let nextDelay = delay * reconnect.multiplier;

		if (reconnect.maxTimes > -1 && times >= reconnect.maxTimes) {
			this._clearTimer();
			this.setState(STATES.LIMITED);

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
}
