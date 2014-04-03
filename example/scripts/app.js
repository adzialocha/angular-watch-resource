/* global angular */

'use strict';

var app = angular.module('app', [ 'ngWatchResource' ]);

app.config(function(ResourceConfigurationProvider) {
  ResourceConfigurationProvider.setBasePath('https://api.soundcloud.com/');
  ResourceConfigurationProvider.setDefaultParams({ 'client_id': 'YOUR_CLIENT_ID' });
});

app.controller('AppCtrl', ['$scope', '$timeout', 'Resource', function($scope, $timeout, Resource)
{
  var _selectedUserId = 545316;

  $scope.selectUser = function(uId) {
    _selectedUserId = uId;
  };

  $scope.user = null;
  $scope.followings = null;

  $scope.$watch(function() {
    return Resource('/users/:id', { id: _selectedUserId }).one('users');
  }, function(rData) {
    $scope.user = rData;
  });

  $scope.$watch(function() {
    return Resource('/users/:id/followings', { id: _selectedUserId }).all('users');
  }, function(rData) {
    $scope.followings = rData;
  });

}]);
