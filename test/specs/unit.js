(function () {

  'use strict';

  var resource;

  beforeEach(function () {
    module('angular-watch-resource');
    inject(function (Resource) {
      resource = Resource;
    });
  });

  describe('angular-watch-resource', function() {

    it ('returns the answer to all questions', function(){
      expect(resource.test()).toEqual(42);
    });

  });

})();
