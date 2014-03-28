/* global angular */

'use strict';

angular.module('app').factory('User', [ 'Resource', function(Resource) {

  var User = {

    one: function(uId) {
      return Resource('users/:id', { id: uId });
    },

    followings: function(uId) {
      return Resource('users/:id/followings', { id: uId }, { isArray: true });
    }

  };

  return User;

}]);
