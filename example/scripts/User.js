/* global angular */

'use strict';

angular.module('app').factory('User', [ 'Resource', function(Resource) {

  var _resourceName = 'users';

  var User = {

    one: function(uParams) {
      return Resource('/[:name]/[:id]', { name: _resourceName, id: uParams.id });
    },

    oneInterval: function(uParams) {
      return Resource('/[:name]/[:id]', { name: _resourceName, id: uParams.id }, { interval: 30000 });
    },

    followers: function(uParams) {
      return Resource('/[:name]/:id/followers',
        { name: _resourceName, id: uParams.id },
        { isArray: true });
    },

    collection: function(uParams) {
      return Resource('/[:name]{:id}', { name: _resourceName, id: uParams.ids });
    }

  };

  return User;

}]);
