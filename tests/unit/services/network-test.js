/* eslint max-statements: 0 no-magic-numbers:0 */
import { moduleFor, test } from 'ember-qunit';
import { STATES } from 'ember-network-state/constants';
import sinon from 'sinon';
import { isSettled } from '@ember/test-helpers/settled';
import waitUntil from '@ember/test-helpers/wait-until';
import { bind } from '@ember/runloop';
import Ember from 'ember';

const { Test } = Ember;

function forSettledWaiters() {
	return !Test.checkWaiters();
}

function wait(fn) {
	return waitUntil(fn, { timeout: Infinity });
}

function waitForIdle() {
	return waitUntil(() => isSettled() && !Test.checkWaiters(), { timeout: Infinity });
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

	return bind(() => {
		context.sandbox.server.respondWith('HEAD', '/favicon.ico', [OK, {}, '']);

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

	return bind(() => {
		context.sandbox.server.respondWith('HEAD', '/favicon.ico', [FAIL, {}, '']);

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

	return bind(() => {
		context.sandbox.server.respondWith('HEAD', '/favicon.ico', [FAIL, {}, '']);

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
	const TICK = 1000;

	return async(time) => {
		for (let i = 0; i < time; i++) {
			try {
				context.tick(TICK);
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

		await waitForIdle();
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

	await waitForIdle();

	assert.equal(service.get('state'), STATES.ONLINE, 'state is expected');
	assert.ok(service.get('isOnline'), 'service is online');
	assert.notOk(service.get('isLimited'), 'service is not limited');
	assert.notOk(service.get('isOffline'), 'service is not offline');
	assert.notOk(service.get('isReconnecting'), 'service is not reconnecting');
});

test('it is offline', async function(assert) {
	this.goOffline();

	const service = this.subject();

	await waitForIdle();

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

	await waitForIdle();

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

	await waitForIdle();

	this.goOnline();

	await waitForIdle();

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

	await waitForIdle();

	this.goOffline();

	await waitForIdle();

	assert.equal(service.get('state'), STATES.OFFLINE, 'initial state is expected');
	assert.notOk(service.get('isOnline'), 'service is not online');
	assert.notOk(service.get('isLimited'), 'service is not limited');
	assert.ok(service.get('isOffline'), 'service is offline');
	assert.notOk(service.get('isReconnecting'), 'service is not reconnecting');
});

test('it changes to offline from limited', async function(assert) {
	this.goLimited();

	const service = this.subject();

	await waitForIdle();

	this.goOffline();

	await waitForIdle();

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

	await waitForIdle();

	this.goLimited();

	await waitForIdle();

	assert.equal(service.get('state'), STATES.LIMITED, 'state is expected');
	assert.notOk(service.get('isOnline'), 'service is not online');
	assert.ok(service.get('isLimited'), 'service is limited');
	assert.notOk(service.get('isOffline'), 'service is not offline');
	assert.notOk(service.get('isReconnecting'), 'service is not reconnecting');
});

test('it tests online connection on network change', async function(assert) {
	this.goOnline();

	const service = this.subject();

	await waitForIdle();

	this.goOnline();

	await waitForIdle();

	assert.equal(service.get('state'), STATES.ONLINE, 'state is expected');
	assert.equal(this.sandbox.server.requestCount, 2, 'requests are expected');
});

test('it supports no implementations of connection API', async function(assert) {
	this.goOnline();

	delete window.navigator.connection;

	const service = this.subject();

	await waitForIdle();

	this.goOnline();

	assert.notOk(service.get('isReconnecting'), 'state is expected');
});

test('"state" property cannot be changed', async function(assert) {
	this.goOffline();

	const service = this.subject();

	await waitForIdle();

	assert.throws(() => {
		service.set('state', STATES.ONLINE);
	});

	await waitForIdle();

	assert.equal(service.get('state'), STATES.OFFLINE, 'state is expected');
});

// reconnect method

test('it reconnects from online', async function(assert) {
	this.goOnline();

	const service = this.subject();

	await waitForIdle();

	service.reconnect();

	assert.ok(service.get('isReconnecting'), 'initial state is expected');

	await waitForIdle();

	assert.equal(service.get('state'), STATES.ONLINE, 'state is expected');
});

test('it reconnects from offline', async function(assert) {
	this.goOffline();

	const service = this.subject();

	await waitForIdle();

	service.reconnect();

	assert.ok(service.get('isReconnecting'), 'initial state is expected');

	await waitForIdle();

	assert.equal(service.get('state'), STATES.OFFLINE, 'state is expected');
});

test('it reconnects from limited', async function(assert) {
	this.goLimited();

	const service = this.subject();

	await waitForIdle();

	service.reconnect();

	assert.ok(service.get('isReconnecting'), 'initial state is expected');

	await waitForIdle();

	assert.equal(service.get('state'), STATES.LIMITED, 'state is expected');
});

test('it does not reconnect when is already reconnecting', async function(assert) {
	this.goOffline();

	const service = this.subject();

	await waitForIdle();

	this.goOnline();

	service.reconnect();

	await waitForIdle();

	assert.equal(service.get('state'), STATES.ONLINE, 'initial state is expected');
	assert.equal(this.sandbox.server.requestCount, 1, 'requests are expected');
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

	await waitForIdle();

	service.on('change', (newState) => {
		assert.equal(newState, STATES.ONLINE, 'event for change');

		service.off('change');
	});

	this.goOnline();

	await waitForIdle();
});

test('it sends change action on limited event', async function(assert) {
	assert.expect(1);

	this.asyncFetch();

	this.goOffline();

	const service = this.subject();

	await waitForIdle();

	service.on('change', (newState) => {
		assert.equal(newState, STATES.LIMITED, 'event for change');

		service.off('change');
	});

	this.goLimited();

	await waitForIdle();
});

test('it sends change action on offline event', async function(assert) {
	assert.expect(1);

	this.goOnline();

	const service = this.subject();

	await waitForIdle();

	service.on('change', (newState) => {
		assert.equal(newState, STATES.OFFLINE, 'event for change');

		service.off('change');
	});

	this.goOffline();

	await waitForIdle();
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

test('it never returns negative remaining', async function(assert) {
	this.sandbox.server.respondImmediately = false;
	this.sandbox.server.autoRespond = true;
	this.sandbox.server.autoRespondAfter = 10;

	this.goLimited();

	this.config.reconnect = {
		auto: true,
		delay: 5000,
		multiplier: 2,
		maxDelay: 60000,
		maxTimes: 2
	};

	const service = this.subject();

	this.sandbox.clock.tick(10);

	await wait(forSettledWaiters);

	assert.ok(service.get('hasTimer'), 'timer is enabled');
	assert.equal(service.get('state'), STATES.LIMITED, 'state is expected');
	assert.equal(service.get('remaining'), 5000, 'first remaining is expected');
	assert.equal(this.sandbox.server.requestCount, 1, 'requests are expected');

	this.sandbox.clock.tick(5005);

	assert.equal(service.get('remaining'), 0, 'third remaining is expected');

	this.sandbox.clock.tick(5);
});

// config

test('it allows path config', async function(assert) {
	const path = '/foo/bar';

	this.goOnline();

	this.config.reconnect = {
		path
	};

	this.sandbox.server.respondWith('HEAD', path, [200, {}, '']);

	const service = this.subject();

	await waitForIdle();

	assert.equal(service.get('state'), STATES.ONLINE, 'state is expected');
});

// fetch

test('it knows last reconnect duration', async function(assert) {
	this.sandbox.server.respondImmediately = false;
	this.sandbox.server.autoRespond = true;
	this.sandbox.server.autoRespondAfter = 5000;

	this.goLimited();

	this.config.reconnect = {
		auto: false
	};

	const service = this.subject();

	this.sandbox.clock.tick(5000);

	await waitForIdle();

	assert.equal(service.get('state'), STATES.LIMITED, 'state is expected');
	assert.equal(service.get('lastReconnectDuration'), 5000, 'duration is expected');
});

test('it knows last reconnect status', async function(assert) {
	this.asyncFetch();

	this.goOnline();

	this.sandbox.server.respondWith('HEAD', '/favicon.ico', [404, {}, '']);

	this.config.reconnect = {
		auto: false
	};

	const service = this.subject();

	await waitForIdle();

	assert.equal(service.get('state'), STATES.ONLINE, 'state is expected');
	assert.equal(service.get('lastReconnectStatus'), 404, 'status is expected');

	this.goLimited();

	await waitForIdle();

	assert.equal(service.get('state'), STATES.LIMITED, 'state is expected');
	assert.notOk(service.get('lastReconnectStatus'), 'status is not expected');
});

// timeout

test('it abort reconnect on timeout', async function(assert) {
	this.sandbox.server.respondImmediately = false;
	this.sandbox.server.autoRespond = false;
	this.config.reconnect = {
		auto: false,
		timeout: 10000
	};

	this.goOnline();

	const service = this.subject();

	await wait(() => Test.checkWaiters());

	this.sandbox.clock.tick(10000);

	await waitForIdle();

	assert.equal(service.get('state'), STATES.LIMITED, 'state is expected');
});


// never trust the API

test('it goes online even when API is offline', async function(assert) {
	this.goOffline();

	const service = this.subject();

	await waitForIdle();

	this.sandbox.server.respondWith('HEAD', '/favicon.ico', [200, {}, '']);

	service.reconnect();

	await waitForIdle();

	assert.equal(service.get('state'), STATES.ONLINE, 'state is expected');
});
