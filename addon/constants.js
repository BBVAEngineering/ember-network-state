export const STATES = {
	ONLINE: 'ONLINE',
	OFFLINE: 'OFFLINE',
	RECONNECTING: 'RECONNECTING',
	LIMITED: 'LIMITED'
};

export const CONFIG = {
	reconnect: {
		auto: true,
		path: '/favicon.ico',
		delay: 5000,
		multiplier: 1.5,
		maxDelay: 60000,
		maxTimes: Infinity
	}
};

export default {
	STATES,
	CONFIG
};
