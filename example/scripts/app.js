/* global angular */

'use strict';

var UPDATE_INTERVAL = 100000;
var DEFAULT_USER_ID = 545316;

var app = angular.module('app', [ 'ngWatchResource' ]);

app.config(function(ResourceConfigurationProvider) {
  ResourceConfigurationProvider.setBasePath('https://api.soundcloud.com/');
  ResourceConfigurationProvider.setDefaultParams({ 'client_id': 'YOUR_CLIENT_ID' });
});

app.filter('timestampToDate', function() {
  return function(sTimestamp){
    var date = new Date(sTimestamp);
    return date.toLocaleTimeString();
  };
});

app.controller('AppCtrl', ['$scope', '$timeout', 'Resource', function($scope, $timeout, Resource)
{
  var _selectedUserId = DEFAULT_USER_ID;

  $scope.selectUser = function(uId) {
    Resource('/users/:id', { id: _selectedUserId }).one('users').stop();
    _selectedUserId = uId;
  };

  $scope.user = null;
  $scope.followings = null;

  $scope.$watch(function() {
    return Resource('/users/:id', { id: _selectedUserId }).one('users', { interval: UPDATE_INTERVAL });
  }, function(rData) {
    $scope.user = rData;
  });

  $scope.$watch(function() {
    return Resource('/users/:id/followings', { id: _selectedUserId }).all('users');
  }, function(rData) {
    $scope.followings = rData;
  });

}]);
