import Application from 'dummy/app';
import config from 'dummy/config/environment';
import * as QUnit from 'qunit';
import { setApplication } from '@ember/test-helpers';
import { setup } from 'qunit-dom';
import { start } from 'ember-qunit';
import { run } from '@ember/runloop';

run.backburner._platform.setTimeout = (fn, ms) => window.setTimeout(fn, ms);

setApplication(Application.create(config.APP));

setup(QUnit.assert);

start();
