import { action } from '@ember/object';
import Evented from '@ember/object/evented';
import Service from '@ember/service';
import { STATES, CONFIG } from '../constants';
import { cancel, later } from '@ember/runloop';
import { getOwner } from '@ember/application';
import { equal, notEmpty, readOnly } from '@ember/object/computed';
import { A } from '@ember/array';
import { tracked } from '@glimmer/tracking';

export default class NetworkService extends Service.extend(Evented) {
	@tracked lastReconnectDuration = 0;
	@tracked lastReconnectStatus = 0;

	@tracked _timer;
	@tracked _times;
	@tracked _timestamp;
	@tracked _state;
	@tracked _controllers;
	@tracked _config;
	@tracked _nextDelay;

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

			this._state = state;

			this.trigger('change', state);
		}
	}

	init() {
		super.init(...arguments);

		const appConfig = getOwner(this).resolveRegistration('config:environment');
		const addonConfig = appConfig['network-state'] || {};
		const reconnect = Object.assign({}, CONFIG.reconnect, addonConfig.reconnect);

		this._times = 0;
		this._controllers = A();
		this._config = { reconnect };

		if (this._connection) {
			this._connection.addEventListener('change', this._changeNetwork);
		} else {
			window.addEventListener('online', this._changeNetwork);
			window.addEventListener('offline', this._changeNetwork);
		}

		const onLine = window.navigator.onLine;

		this.setState(onLine ? STATES.ONLINE : STATES.OFFLINE);

		if (onLine) {
			this.reconnect();
		}
	}

	willDestroy() {
		super.willDestroy(...arguments);

		if (this._connection) {
			this._connection.removeEventListener('change', this._changeNetwork);
		}

		window.removeEventListener('online', this._changeNetwork);
		window.removeEventListener('offline', this._changeNetwork);
	}

	get _connection() {
		return window.navigator.connection || window.navigator.mozConnection || window.navigator.webkitConnection;
	}

	_clearTimer() {
		const timer = this._timer;

		if (timer) {
			cancel(timer);
			this._timer = undefined;
		}

		this._nextDelay = undefined;
		this._times = 0;
		this._timestamp = undefined;
	}

	@action
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

	_fetch(...args) {
		return window.fetch(...args);
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
			const response = await this._fetch(reconnect.path, {
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
				this.lastReconnectStatus = status;
				this.lastReconnectDuration = performance.now() - start;
			}
		}
	}

	_abortControllers() {
		const controllers = [...this._controllers];

		controllers.forEach((controller) => {
			controller.abort();
		});

		this._controllers.removeObjects(controllers);
	}

	_handleError() {
		const { reconnect } = this._config;
		const onLine = window.navigator.onLine;

		if (onLine) {
			this.setState(STATES.LIMITED);

			if (reconnect.auto) {
				this._times++;
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

		this._nextDelay = nextDelay;
		this._timestamp = Date.now() + delay;
		this._timer = timer;
	}
}
