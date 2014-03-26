(function(window, angular, undefined) {

  'use strict';

  var ngWatchResource = angular.module('angular-watch-resource', []);

  ngWatchResource.factory('Resource', [ function() {

    var watchResource = {
      test: function() {
        return 42;
      }
    };

    return watchResource;

  }]);

})(window, window.angular);
