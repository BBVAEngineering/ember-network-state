/* eslint max-statements: 0 no-magic-numbers:0 */
import { moduleFor, test, only } from 'ember-qunit';
import { STATES } from 'ember-network-state/constants';
import sinon from 'sinon';
import settled, { getSettledState } from '@ember/test-helpers/settled';
import waitUntil from '@ember/test-helpers/wait-until';
import { begin, end } from '@ember/runloop';

function forSettledWaiters() {
	const { hasPendingWaiters } = getSettledState();

	return !hasPendingWaiters;
}

function wait(fn) {
	return waitUntil(fn, { timeout: Infinity });
}

function run(fn) {
	return () => {
		begin();
		fn();
		end();
	};
}

function asyncFetch(context) {
	return () => {
		context.sandbox.server.respondImmediately = false;
		context.sandbox.server.autoRespond = true;
		context.sandbox.clock.restore();
	};
}

function goOnline(context) {
	const OK = 200;

	return run(() => {
		context.sandbox.server.respondWith('GET', '/favicon.ico', [OK, {}, '']);

		if (!context.navigator.onLine) {
			context.navigator.onLine = true;
			window.dispatchEvent(new Event('online'));
		}

		if (context.navigator.connection) {
			context.navigator.connection.dispatchEvent(new Event('change'));
		}
	});
}

function goOffline(context) {
	const FAIL = 0;

	return run(() => {
		context.sandbox.server.respondWith('GET', '/favicon.ico', [FAIL, {}, '']);

		if (context.navigator.onLine) {
			context.navigator.onLine = false;
			window.dispatchEvent(new Event('offline'));
		}

		if (context.navigator.connection) {
			context.navigator.connection.dispatchEvent(new Event('change'));
		}
	});
}

function goLimited(context) {
	const FAIL = 0;

	return run(() => {
		context.sandbox.server.respondWith('GET', '/favicon.ico', [FAIL, {}, '']);

		if (!context.navigator.onLine) {
			context.navigator.onLine = true;
			window.dispatchEvent(new Event('online'));
		}

		if (context.navigator.connection) {
			context.navigator.connection.dispatchEvent(new Event('change'));
		}
	});
}

function tick(context) {
	const SECOND = 1000;

	return async (time) => {
		for (let i = 0; i < time; i++) {
			try {
				context.tick(SECOND);
			} catch (e) {
				// noop
			}

			await wait(forSettledWaiters);
		}
	};
}

moduleFor('service:network', 'Unit | Services | network', {
	beforeEach() {
		this.sandbox = sinon.sandbox.create({
			useFakeTimers: true,
			useFakeServer: true
		});
		this.sandbox.server.respondImmediately = true;
		this.config = {};
		this.goOnline = goOnline(this);
		this.goOffline = goOffline(this);
		this.goLimited = goLimited(this);
		this.asyncFetch = asyncFetch(this);
		this.tick = tick(this.sandbox.clock);
		this.register('config:environment', { 'network-state': this.config }, { instantiate: false });
		this._navigator = window.navigator;
		this.navigator = { connection: new EventTarget() };
		this.goOnline();

		Object.defineProperty(window, 'navigator', {
			get: () => this.navigator,
			configurable: true
		});
	},
	async afterEach() {
		Object.defineProperty(window, 'navigator', {
			get: () => this._navigator,
			configurable: true
		});

		this.sandbox.restore();

		await settled();
	}
});

// initial states.

test('it exists', function(assert) {
	assert.expect(0);

	this.subject();
});

test('it is online', async function(assert) {
	this.goOnline();

	const service = this.subject();

	assert.equal(service.get('state'), STATES.ONLINE, 'initial state is expected');
	assert.ok(service.get('isOnline'), 'service is online');
	assert.notOk(service.get('isLimited'), 'service is not limited');
	assert.notOk(service.get('isOffline'), 'service is not offline');
	assert.ok(service.get('isReconnecting'), 'state is expected');

	await settled();

	assert.equal(service.get('state'), STATES.ONLINE, 'state is expected');
	assert.ok(service.get('isOnline'), 'service is online');
	assert.notOk(service.get('isLimited'), 'service is not limited');
	assert.notOk(service.get('isOffline'), 'service is not offline');
	assert.notOk(service.get('isReconnecting'), 'service is not reconnecting');
});

test('it is offline', async function(assert) {
	this.goOffline();

	const service = this.subject();

	await settled();

	assert.equal(service.get('state'), STATES.OFFLINE, 'initial state is expected');
	assert.notOk(service.get('isOnline'), 'service is not online');
	assert.notOk(service.get('isLimited'), 'service is not limited');
	assert.ok(service.get('isOffline'), 'service is offline');
	assert.notOk(service.get('isReconnecting'), 'service is not reconnecting');
});

test('it is limited', async function(assert) {
	this.goLimited();

	const service = this.subject();

	assert.equal(service.get('state'), STATES.ONLINE, 'initial state is expected');
	assert.ok(service.get('isOnline'), 'service is online');
	assert.notOk(service.get('isLimited'), 'service is not limited');
	assert.notOk(service.get('isOffline'), 'service is not offline');
	assert.ok(service.get('isReconnecting'), 'state is expected');

	await settled();

	assert.equal(service.get('state'), STATES.LIMITED, 'state is expected');
	assert.notOk(service.get('isOnline'), 'service is not online');
	assert.ok(service.get('isLimited'), 'service is limited');
	assert.notOk(service.get('isOffline'), 'service is not offline');
	assert.notOk(service.get('isReconnecting'), 'service is not reconnecting');
});

// state changes.

test('it changes to online from offline', async function(assert) {
	this.goOffline();

	const service = this.subject();

	await settled();

	this.goOnline();

	assert.equal(service.get('state'), STATES.OFFLINE, 'initial state is expected');
	assert.notOk(service.get('isOnline'), 'service is not online');
	assert.notOk(service.get('isLimited'), 'service is not limited');
	assert.ok(service.get('isOffline'), 'service is offline');
	assert.ok(service.get('isReconnecting'), 'state is expected');

	await settled();

	assert.equal(service.get('state'), STATES.ONLINE, 'state is expected');
	assert.ok(service.get('isOnline'), 'service is online');
	assert.notOk(service.get('isLimited'), 'service is not limited');
	assert.notOk(service.get('isOffline'), 'service is not offline');
	assert.notOk(service.get('isReconnecting'), 'service is not reconnecting');
	assert.equal(this.sandbox.server.requestCount, 1, 'requests are expected');
});

test('it changes to offline from online', async function(assert) {
	this.goOnline();

	const service = this.subject();

	await settled();

	this.goOffline();

	await settled();

	assert.equal(service.get('state'), STATES.OFFLINE, 'initial state is expected');
	assert.notOk(service.get('isOnline'), 'service is not online');
	assert.notOk(service.get('isLimited'), 'service is not limited');
	assert.ok(service.get('isOffline'), 'service is offline');
	assert.notOk(service.get('isReconnecting'), 'service is not reconnecting');
});

test('it changes to offline from limited', async function(assert) {
	this.goLimited();

	const service = this.subject();

	await settled();

	this.goOffline();

	await settled();

	assert.equal(service.get('state'), STATES.OFFLINE, 'initial state is expected');
	assert.notOk(service.get('isOnline'), 'service is not online');
	assert.notOk(service.get('isLimited'), 'service is not limited');
	assert.ok(service.get('isOffline'), 'service is offline');
	assert.notOk(service.get('isReconnecting'), 'service is not reconnecting');
});

test('it changes to limited from online', async function(assert) {
	this.asyncFetch();

	this.goOnline();

	const service = this.subject();

	await settled();

	this.goLimited();

	assert.equal(service.get('state'), STATES.ONLINE, 'initial state is expected');
	assert.ok(service.get('isOnline'), 'service is online');
	assert.notOk(service.get('isLimited'), 'service is not limited');
	assert.notOk(service.get('isOffline'), 'service is not offline');
	assert.ok(service.get('isReconnecting'), 'state is expected');

	await settled();

	assert.equal(service.get('state'), STATES.LIMITED, 'state is expected');
	assert.notOk(service.get('isOnline'), 'service is not online');
	assert.ok(service.get('isLimited'), 'service is limited');
	assert.notOk(service.get('isOffline'), 'service is not offline');
	assert.notOk(service.get('isReconnecting'), 'service is not reconnecting');
});

test('it tests online connection on network change', async function(assert) {
	this.goOnline();

	const service = this.subject();

	await settled();

	this.goOnline();

	assert.ok(service.get('isReconnecting'), 'state is expected');

	await settled();

	assert.equal(service.get('state'), STATES.ONLINE, 'state is expected');
});

test('it supports no implementations of connection API', async function(assert) {
	this.goOnline();

	delete window.navigator.connection;

	const service = this.subject();

	await settled();

	this.goOnline();

	assert.notOk(service.get('isReconnecting'), 'state is expected');
});

test('"state" property cannot be changed', async function(assert) {
	this.goOffline();

	const service = this.subject();

	await settled();

	service.set('state', STATES.ONLINE);

	await settled();

	assert.equal(service.get('state'), STATES.OFFLINE, 'state is expected');
});

// reconnect method

test('it reconnects from online', async function(assert) {
	this.goOnline();

	const service = this.subject();

	await settled();

	service.reconnect();

	assert.ok(service.get('isReconnecting'), 'initial state is expected');

	await settled();

	assert.equal(service.get('state'), STATES.ONLINE, 'state is expected');
});

test('it reconnects from offline', async function(assert) {
	this.goOffline();

	const service = this.subject();

	await settled();

	service.reconnect();

	assert.ok(service.get('isReconnecting'), 'initial state is expected');

	await settled();

	assert.equal(service.get('state'), STATES.OFFLINE, 'state is expected');
});

test('it reconnects from limited', async function(assert) {
	this.goLimited();

	const service = this.subject();

	await settled();

	service.reconnect();

	assert.ok(service.get('isReconnecting'), 'initial state is expected');

	await settled();

	assert.equal(service.get('state'), STATES.LIMITED, 'state is expected');
});

// timer

test('it keeps reconnecting until reconnect goes ok without connection API', async function(assert) {
	this.goLimited();

	delete window.navigator.connection;

	this.config.reconnect = {
		auto: true,
		delay: 10000,
		multiplier: 2,
		maxDelay: 60000,
		maxTimes: Infinity
	};

	const service = this.subject();

	await wait(forSettledWaiters);

	await this.tick(70);

	this.goOnline();

	assert.notEqual(service.get('state'), STATES.ONLINE, 'state is expected');
	assert.equal(this.sandbox.server.requestCount, 4, 'requests are expected');

	await this.tick(60);

	assert.equal(service.get('state'), STATES.ONLINE, 'state is expected');
	assert.equal(this.sandbox.server.requestCount, 5, 'requests are expected');
});

test('it keeps reconnecting until reconnect goes ok with connection API', async function(assert) {
	this.goLimited();

	this.config.reconnect = {
		auto: true,
		delay: 10000,
		multiplier: 2,
		maxDelay: 60000,
		maxTimes: Infinity
	};

	const service = this.subject();

	await wait(forSettledWaiters);

	await this.tick(70);

	this.goOnline();

	await wait(forSettledWaiters);

	assert.equal(service.get('state'), STATES.ONLINE, 'state is expected');
	assert.equal(this.sandbox.server.requestCount, 5, 'requests are expected');
});

test('it keeps reconnecting until network goes offline', async function(assert) {
	this.goLimited();

	this.config.reconnect = {
		auto: true,
		delay: 10000,
		multiplier: 2,
		maxDelay: 60000,
		maxTimes: Infinity
	};

	const service = this.subject();

	await wait(forSettledWaiters);

	await this.tick(70);

	this.goOffline();

	await wait(forSettledWaiters);

	assert.equal(service.get('state'), STATES.OFFLINE, 'state is expected');
	assert.equal(this.sandbox.server.requestCount, 4, 'requests are expected');
});

test('it keeps reconnecting until it reaches max tries', async function(assert) {
	this.goLimited();

	this.config.reconnect = {
		auto: true,
		delay: 5000,
		multiplier: 2,
		maxDelay: 60000,
		maxTimes: 3
	};

	const service = this.subject();

	await wait(forSettledWaiters);

	await this.tick(45);

	assert.equal(service.get('state'), STATES.LIMITED, 'state is expected');
	assert.equal(this.sandbox.server.requestCount, 3, 'requests are expected');
});

test('it resets reconnects when forced', async function(assert) {
	this.goLimited();

	this.config.reconnect = {
		auto: true,
		delay: 5000,
		multiplier: 2,
		maxDelay: 60000,
		maxTimes: 4
	};

	const service = this.subject();

	await wait(forSettledWaiters);

	await this.tick(15);

	assert.equal(service.get('state'), STATES.LIMITED, 'state is expected');
	assert.equal(this.sandbox.server.requestCount, 3, 'requests are expected');

	service.reconnect();

	await this.tick(45);

	assert.equal(service.get('state'), STATES.LIMITED, 'state is expected');
	assert.equal(this.sandbox.server.requestCount, 7, 'requests are expected');
});

// change event

test('it sends change action on online event', async function(assert) {
	assert.expect(1);

	this.goOffline();

	const service = this.subject();

	await settled();

	service.on('change', (newState) => {
		assert.equal(newState, STATES.ONLINE, 'event for change');

		service.off('change');
	});

	this.goOnline();
});

test('it sends change action on limited event', async function(assert) {
	assert.expect(1);

	this.asyncFetch();

	this.goOffline();

	const service = this.subject();

	await settled();

	service.on('change', (newState) => {
		assert.equal(newState, STATES.LIMITED, 'event for change');

		service.off('change');
	});

	this.goLimited();
});

test('it sends change action on offline event', async function(assert) {
	assert.expect(1);

	this.goOnline();

	const service = this.subject();

	await settled();

	service.on('change', (newState) => {
		assert.equal(newState, STATES.OFFLINE, 'event for change');

		service.off('change');
	});

	this.goOffline();
});

// remaining

test('it returns remaining time for next reconnect', async function(assert) {
	this.goLimited();

	this.config.reconnect = {
		auto: true,
		delay: 5000,
		multiplier: 2,
		maxDelay: 60000,
		maxTimes: 3
	};

	const service = this.subject();

	await wait(forSettledWaiters);

	assert.ok(service.get('hasTimer'), 'timer is enabled');
	assert.equal(service.get('state'), STATES.LIMITED, 'state is expected');
	assert.equal(service.get('remaining'), 5000, 'first remaining is expected');
	assert.equal(this.sandbox.server.requestCount, 1, 'requests are expected');

	await this.tick(2);

	assert.ok(service.get('hasTimer'), 'timer is enabled');
	assert.equal(service.get('remaining'), 3000, 'second remaining is expected');
	assert.equal(this.sandbox.server.requestCount, 1, 'requests are expected');

	await this.tick(5);

	assert.ok(service.get('hasTimer'), 'timer is enabled');
	assert.equal(service.get('remaining'), 8000, 'third remaining is expected');
	assert.equal(this.sandbox.server.requestCount, 2, 'requests are expected');

	await this.tick(10);

	assert.notOk(service.get('hasTimer'), 'timer is disabled');
	assert.ok(isNaN(service.get('remaining')), 'forth remaining is expected');
	assert.equal(this.sandbox.server.requestCount, 3, 'requests are expected');
});

// config

test('it allows path config', async function(assert) {
	const path = '/foo/bar';

	this.goOnline();

	this.config.reconnect = {
		path
	};

	this.sandbox.server.respondWith('GET', path, [200, {}, '']);

	const service = this.subject();

	await settled();

	assert.equal(service.get('state'), STATES.ONLINE, 'state is expected');
});

// fetch time

only('it saves fetch time', async function(assert) {
	this.sandbox.server.respondImmediately = false;
	this.sandbox.server.autoRespond = true;
	this.sandbox.server.autoRespondAfter = 5000;

	this.goLimited();

	this.config.reconnect = {
		auto: false
	};

	const service = this.subject();

	this.sandbox.clock.tick(5000);

	await settled();

	assert.equal(service.get('state'), STATES.LIMITED, 'state is expected');
	assert.equal(service.get('lastReconnectDuration'), 5000, 'duration is expected');
});
