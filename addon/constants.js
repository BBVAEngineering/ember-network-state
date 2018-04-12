export const STATES = {
	ONLINE: 'ONLINE',
	OFFLINE: 'OFFLINE',
	RECONNECTING: 'RECONNECTING'
};

export const CONFIG = {
	reconnect: {
		path: '/favicon.ico',
		delay: 5000,
		multiplier: 1.5,
		max: 60000
	}
};

export default {
	STATES,
	CONFIG
};
