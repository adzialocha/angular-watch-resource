/* global angular */

'use strict';

var app = angular.module('app', [ 'ngWatchResource' ]);

app.config(function(ResourceConfigurationProvider) {
  ResourceConfigurationProvider.setBasePath('https://api.soundcloud.com');
  ResourceConfigurationProvider.setDefaultParams({ 'client_id': 'YOUR_CLIENT_ID' });
});

app.filter('timestampToDate', function() {
  return function(sTimestamp){
    var date = new Date(sTimestamp);
    return date.toLocaleTimeString();
  };
});

app.controller('AppCtrl', ['$scope', 'User', function($scope, User)
{
  var _userId = 2122;

  $scope.hello = 'Yo Soundcloud.';

  $scope.app = {
    user: null,
    followers: null
  };

  $scope.app.goToUser = function(uId) {
    _userId = uId;
  };

  $scope.$watch(function() {
    return User.one({ id: _userId });
  }, function(rUser) {
    $scope.app.user = rUser;
  });

  $scope.$watch(function() {
    return User.followers({ id: _userId });
  }, function(rUserFollowers) {
    $scope.app.followers = rUserFollowers;
  });

}]);
