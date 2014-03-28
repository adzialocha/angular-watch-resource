'use strict';

var resource;

beforeEach(function () {
  module('angular-watch-resource');
  inject(function (Resource) {
    resource = Resource;
  });
});

describe('angular-watch-resource', function() {

  it ('test', function() {
    expect(42).toEqual(42);
  });

});
