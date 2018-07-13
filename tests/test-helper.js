import Application from '../app';
import { setApplication } from '@ember/test-helpers';
import { start } from 'ember-qunit';
import { run } from '@ember/runloop';

run.backburner._platform.setTimeout = (fn, ms) => window.setTimeout(fn, ms);

setApplication(Application.create({ autoboot: false }));

start();
