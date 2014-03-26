/* global angular */

'use strict';

var app = angular.module('app', [ 'angular-watch-resource' ]);

app.controller('AppCtrl', ['$scope', function($scope)
{
  $scope.hello = 'Yo.';
}]);
