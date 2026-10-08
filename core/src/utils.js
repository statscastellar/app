'use strict';

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function unique(values) {
  return new Set(values).size === values.length;
}

module.exports = { clone, assert, unique };
