/* global angular */

'use strict';

var app = angular.module('app', [ 'angular-watch-resource' ]);

app.config(function(ResourceConfigurationProvider) {
  ResourceConfigurationProvider.setBasePath('http://api.soundcloud.com/');
  ResourceConfigurationProvider.setDefaultParams({ 'client_id': 'YOUR_CLIENT_ID', test: [1,2,3,4] });
});

app.controller('AppCtrl', ['$scope', 'User', function($scope, User)
{
  $scope.hello = 'Yo. ';

  $scope.$watch(function() {
    return User.one(3207);
  }, function(wData) {
    $scope.user = wData;
    console.log(wData);
  });

  $scope.$watch(function() {
    return User.followings(3207);
  }, function(wData) {
    console.log(wData);
    $scope.followings = wData;
  });
}]);
