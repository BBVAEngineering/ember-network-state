# ember-network-state

[![Build Status](https://travis-ci.org/BBVAEngineering/ember-network-state.svg?branch=master)](https://travis-ci.org/BBVAEngineering/ember-network-state)
[![GitHub version](https://badge.fury.io/gh/BBVAEngineering%2Fember-network-state.svg)](https://badge.fury.io/gh/BBVAEngineering%2Fember-network-state)
[![npm version](https://badge.fury.io/js/ember-network-state.svg)](https://badge.fury.io/js/ember-network-state)
[![Dependency Status](https://david-dm.org/BBVAEngineering/ember-network-state.svg)](https://david-dm.org/BBVAEngineering/ember-network-state)

## Information

[![NPM](https://nodei.co/npm/ember-network-state.png?downloads=true&downloadRank=true)](https://nodei.co/npm/ember-network-state/)

Check and react on network state of your progressive web app

## Usage

Install the addon with ember-cli.

```javascript
ember install ember-network-state
```

Inject the service in your app:

```javascript
export default Component.extend({
  network: inject()
});
```

### Interface

#### Properties

- `state`: returns current state of the network. Posible values: `ONLINE`, `OFFLINE` and `RECONNECTING`. You can import values from:
  `import { STATES } from 'ember-network-state/constants';`

- `remaining`: returns remaining milliseconds to next reconnect.

- `isOnline`: computed value from `state` that returns when is `ONLINE`.

- `isOffline`: computed value from `state` that returns when is `OFFLINE`.

- `isReconnecting`: computed value from `state` that returns when is `RECONNECTING`.

#### Methods

- `reconnect`: you can call this method to force a reconnect request. Next delay will be multiplied as if it will reach countdown to zero.

#### Events

You can subscribe to the `change` event to receive changes on `state` property.

```
init() {
  const network = this.get('network');

  network.on('change', (state) => {});
}
```

### Configuration

The addon can be configured in `config/environment.js` of your app.

```
module.exports = function(/* environment */) {
  return {
    network: {
      reconnect: {
        path: '/favicon.ico',
        delay: 5000,
        multiplier: 1.5,
        max: 60000
      }
    }
  };
};
```

Posible values:

- `reconnect`: Object to configure reconnect parameters.
  - `path`: Path to request on reconnect. Default: `/favicon.ico`.
  - `delay`: Initial delay for retry a reconnection. Default: `5000`.
  - `multiplier`: Increment for next retry. Next delay will be `delay * multiplier`. Default: `1.5`.
  - `max`: Maximum time for a reconnect. Default: `60000`.

## Contribute

If you want to contribute to this addon, please read the [CONTRIBUTING.md](CONTRIBUTING.md).

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/BBVAEngineering/ember-network-state/tags).


## Authors

See the list of [contributors](https://github.com/BBVAEngineering/ember-network-state/graphs/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
