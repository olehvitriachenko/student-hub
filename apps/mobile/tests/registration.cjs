// Exercise the real registration view model without a running Expo app or API.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpile(fs.readFileSync(filename, 'utf8'), {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  }), filename);
};
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === 'expo-constants') return { default: {} };
  return load.call(this, name, ...args);
};
const { RegisterViewModel } = require('../src/viewmodels/AuthViewModels.ts');
const auth = { isEmailAvailable: () => new Promise(() => {}) };
const vm = new RegisterViewModel(auth, {}, {}, {});
vm.email = 'invalid';
vm.nextCommand.execute();
assert.equal(vm.step, 1);
assert.equal(vm.error, 'Некоректний email');
// Command releases its asynchronous running state in a microtask.
setImmediate(() => {
  vm.email = 'student@example.com';
  vm.nextCommand.execute();
  assert.equal(vm.step, 2, 'A valid email advances without waiting for the API');
  console.log('Registration validation and offline step transition passed');
});
