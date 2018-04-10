/* eslint max-statements: 0 */
import { moduleFor, test } from 'ember-qunit';
import cases from 'qunit-parameterize';
import { STATES } from 'ember-network-state/constants';
import sinon from 'sinon';
import settled, { getSettledState } from '@ember/test-helpers/settled';
import waitUntil from '@ember/test-helpers/wait-until';

function forSettledWaiters() {
	const { hasPendingWaiters } = getSettledState();

	return !hasPendingWaiters;
}

function forSettledTimers() {
	const { hasPendingTimers } = getSettledState();

	return !hasPendingTimers;
}

function wait(fn) {
	return waitUntil(fn, { timeout: Infinity });
}

moduleFor('service:network', 'Unit | Services | network', {
	beforeEach() {
		this.config = {};
		this.register('config:environment', this.config, { instantiate: false });
	},
	afterEach() {
		return settled();
	}
});

test('it exists', function(assert) {
	assert.expect(0);

	this.subject();
});

cases([
	{ title: 'online', input: true, output: STATES.ONLINE },
	{ title: 'offline', input: false, output: STATES.OFFLINE }
]).test('it reads initial state from navigator ', function({ input, output }, assert) {
	const service = this.subject({ navigator: { onLine: input } });

	assert.equal(service.get('state'), output, 'initial state is expected');
});

test('it has an isOnline attribute', function(assert) {
	const service = this.subject({ state: null });

	assert.notOk(service.get('isOnline'), 'service is not online');

	service.set('state', STATES.ONLINE);

	assert.ok(service.get('isOnline'), 'service is online');
});

test('it has an isOffline attribute', function(assert) {
	const service = this.subject({ state: null });

	assert.notOk(service.get('isOffline'), 'service is not offline');

	service.set('state', STATES.OFFLINE);

	assert.ok(service.get('isOffline'), 'service is offline');
});

test('it has an isReconnecting attribute', function(assert) {
	const service = this.subject({ state: null });

	assert.notOk(service.get('isReconnecting'), 'service is not reconnecting');

	service.set('state', STATES.RECONNECTING);

	assert.ok(service.get('isReconnecting'), 'service is reconnecting');
});

test('it listens for offline network changes', function(assert) {
	const navigator = { onLine: true };
	const service = this.subject({ navigator });

	assert.equal(service.get('state'), STATES.ONLINE, 'state is online');

	navigator.onLine = false;

	window.dispatchEvent(new Event('offline'));

	assert.equal(service.get('state'), STATES.OFFLINE, 'state is offline');
});

test('it listens for online network changes', function(assert) {
	const navigator = { onLine: false };
	const service = this.subject({ navigator });

	assert.equal(service.get('state'), STATES.OFFLINE, 'state is offline');

	navigator.onLine = true;

	window.dispatchEvent(new Event('online'));

	assert.equal(service.get('state'), STATES.RECONNECTING, 'state is reconnecting');
});

test('it triggers an event for offline network changes', function(assert) {
	assert.expect(1);

	const service = this.subject({ state: null });

	service.on('change', (state) => {
		assert.equal(state, STATES.OFFLINE, 'event for offline');

		service.off('change');
	});

	service.set('state', STATES.OFFLINE);
});

test('it triggers an event for reconnect network changes', function(assert) {
	assert.expect(1);

	const service = this.subject({ state: null });

	service.on('change', (state) => {
		assert.equal(state, STATES.RECONNECTING, 'event for offline');

		service.off('change');
	});

	service.set('state', STATES.RECONNECTING);
});

test('it triggers an event for online network changes', function(assert) {
	assert.expect(1);

	const service = this.subject({ state: null });

	service.on('change', (state) => {
		assert.equal(state, STATES.ONLINE, 'event for offline');

		service.off('change');
	});

	service.set('state', STATES.ONLINE);
});

test('it reconnects when ping is ok', async function(assert) {
	const OK = 200;
	const server = sinon.fakeServer.create();
	const service = this.subject({ state: null });

	server.respondWith('GET', '/favicon.ico', [OK, {}, '']);

	service.set('state', STATES.RECONNECTING);

	assert.equal(service.get('state'), STATES.RECONNECTING, 'state is reconnecting');

	server.respond();

	await settled();

	assert.equal(service.get('state'), STATES.ONLINE, 'state is online');
	assert.equal(server.requests.length, 1);

	server.restore();
});

test('it reconnects when ping is not ok', async function(assert) {
	const NOT_OK = 404;
	const server = sinon.fakeServer.create();
	const service = this.subject({ state: null });

	server.respondWith('GET', '/favicon.ico', [NOT_OK, {}, '']);

	service.set('state', STATES.RECONNECTING);

	assert.equal(service.get('state'), STATES.RECONNECTING, 'state is reconnecting');

	server.respond();

	await settled();

	assert.equal(service.get('state'), STATES.ONLINE, 'state is online');
	assert.equal(server.requests.length, 1);

	server.restore();
});

test('it keeps reconnecting when ping fails until it goes fine', async function(assert) {
	const FAIL = 0;
	const OK = 200;
	const server = sinon.fakeServer.create();
	const clock = sinon.useFakeTimers();
	const service = this.subject({ state: null });
	const multiplier = 1.5;
	const max = 60000;
	const times = 10;
	let delay = 5000;
	let i = times, j = times;

	server.respondWith('GET', '/favicon.ico', (xhr) => {
		if (!i) {
			xhr.respond(OK, {}, '');
			return;
		}

		xhr.respond(FAIL, {}, '');

		i--;
	});

	service.set('state', STATES.RECONNECTING);

	while (j) {
		assert.equal(service.get('state'), STATES.RECONNECTING, 'state is reconnecting');

		server.respond();

		await wait(forSettledWaiters);

		assert.equal(service.get('state'), STATES.RECONNECTING, 'state is reconnecting');

		clock.tick(delay);

		delay *= multiplier;

		if (delay > max) {
			delay = max;
		}

		await wait(forSettledTimers);

		j--;
	}

	server.respond();

	await wait(forSettledWaiters);

	assert.equal(service.get('state'), STATES.ONLINE, 'state is online');

	await settled();

	assert.equal(server.requests.length, times + 1);

	server.restore();
	clock.restore();
});

test('it keeps reconnecting after a successful reconnect', async function(assert) {
	const FAIL = 0;
	const OK = 200;
	const server = sinon.fakeServer.create();
	const clock = sinon.useFakeTimers();
	const service = this.subject({ state: null });
	const delay = 5000;
	let times = 3;
	let localTimes = 2;

	server.respondWith('GET', '/favicon.ico', (xhr) => {
		if (times % 2 === 0) {
			xhr.respond(OK, {}, '');
			return;
		}

		xhr.respond(FAIL, {}, '');

		times--;
	});

	while (localTimes) {
		service.set('state', STATES.RECONNECTING);

		server.respond(); // fail

		await wait(forSettledWaiters);

		clock.tick(delay);

		await wait(forSettledTimers);

		server.respond(); // ok

		await wait(forSettledWaiters);

		assert.equal(service.get('state'), STATES.ONLINE, 'state is online');

		localTimes--;
	}

	await settled();

	assert.equal(server.requests.length, times + 1);

	server.restore();
	clock.restore();
});

test('it returns remaining time for next reconnect', async function(assert) {
	const FAIL = 0;
	const OK = 200;
	const server = sinon.fakeServer.create();
	const clock = sinon.useFakeTimers();
	const service = this.subject({ state: null });
	const delay = 5000;
	let times = 1;

	server.respondWith('GET', '/favicon.ico', (xhr) => {
		if (!times) {
			xhr.respond(OK, {}, '');
			return;
		}

		xhr.respond(FAIL, {}, '');

		times--;
	});

	service.set('state', STATES.RECONNECTING);

	assert.ok(isNaN(service.get('remaining')), 'remaining is not available');

	server.respond(); // fail

	await wait(forSettledWaiters);

	assert.equal(service.get('remaining'), delay, 'remaining is expected');

	clock.tick(delay / 2);

	assert.equal(service.get('remaining'), delay / 2, 'remaining is expected');

	clock.tick(delay / 2);

	await wait(forSettledTimers);

	server.respond(); // ok

	await wait(forSettledWaiters);

	assert.ok(isNaN(service.get('remaining')), 'remaining is not available');

	server.restore();
	clock.restore();
});

test('it does not try to reconnect when state changes', async function(assert) {
	const FAIL = 0;
	const server = sinon.fakeServer.create();
	const clock = sinon.useFakeTimers();
	const service = this.subject({ state: null });

	server.respondWith('GET', '/favicon.ico', [FAIL, {}, '']);

	service.set('state', STATES.RECONNECTING);

	server.respond();

	await wait(forSettledWaiters);

	service.set('state', STATES.OFFLINE);

	await settled();

	assert.equal(service.get('state'), STATES.OFFLINE, 'state is offline');
	assert.equal(server.requests.length, 1);

	server.restore();
	clock.restore();
});

test('it reads reconnection configuration from app', async function(assert) {
	const path = '/foo.ico';
	const multiplier = 2;
	const max = 120000;
	let delay = 10000;

	this.config.network = {
		reconnect: { multiplier, max, delay, path }
	};

	const FAIL = 0;
	const OK = 200;
	const server = sinon.fakeServer.create();
	const clock = sinon.useFakeTimers();
	const service = this.subject({ state: null });
	const times = 10;
	let i = times, j = times;

	server.respondWith('GET', path, (xhr) => {
		if (!i) {
			xhr.respond(OK, {}, '');
			return;
		}

		xhr.respond(FAIL, {}, '');

		i--;
	});

	service.set('state', STATES.RECONNECTING);

	while (j) {
		assert.equal(service.get('state'), STATES.RECONNECTING, 'state is reconnecting');

		server.respond();

		await wait(forSettledWaiters);

		assert.equal(service.get('state'), STATES.RECONNECTING, 'state is reconnecting');

		clock.tick(delay);

		delay *= multiplier;

		if (delay > max) {
			delay = max;
		}

		await wait(forSettledTimers);

		j--;
	}

	server.respond();

	await wait(forSettledWaiters);

	assert.equal(service.get('state'), STATES.ONLINE, 'state is online');

	await settled();

	assert.equal(server.requests.length, times + 1);

	server.restore();
	clock.restore();
});
