'use strict';

var API_BASE_PATH = 'https://api.myservice.de';
var DEFAULT_HEADERS = { 'auth_token': 'some_secret_token' };

var resourcesMock = {
  users: [
    { id: 512, name: 'Henry' },
    { id: 12, name: 'Peter' },
    { id: 712, name: 'Paul' },
    { id: 42, name: 'Helmut' }
  ]
};

var Resource, ResourceConfiguration, $http;

beforeEach(function () {

  module('ngWatchResource', function(ResourceConfigurationProvider) {
    ResourceConfigurationProvider.setBasePath(API_BASE_PATH);
    ResourceConfigurationProvider.setDefaultHeaders(DEFAULT_HEADERS);
  });

  inject(function (_Resource_, _ResourceConfiguration_, $httpBackend) {
    Resource = _Resource_;
    ResourceConfiguration = _ResourceConfiguration_;
    $http = $httpBackend;

    $http.when( 'GET', API_BASE_PATH + '/users/' ).respond(200, resourcesMock.users);

    $http.when( 'GET', API_BASE_PATH + '/users/512' ).respond(200, resourcesMock.users[0]);
    $http.when( 'GET', API_BASE_PATH + '/users/12' ).respond(200, resourcesMock.users[1]);
    $http.when( 'GET', API_BASE_PATH + '/users/712' ).respond(200, resourcesMock.users[2]);
    $http.when( 'GET', API_BASE_PATH + '/users/42' ).respond(200, resourcesMock.users[3]);

    var collection = [
      resourcesMock.users[1],
      resourcesMock.users[3],
      resourcesMock.users[2]
    ];

    $http.when( 'GET', API_BASE_PATH + '/users?id[]=12&id[]=42&id[]=712').respond(200, collection);
  });

});

describe('ResourceConfigurationProvider', function() {

  it ('set the base path', function() {
    expect(ResourceConfiguration.basePath).toEqual(API_BASE_PATH);
  });

  it ('set some default headers', function() {
    expect(ResourceConfiguration.defaultHeaders).toEqual(DEFAULT_HEADERS);
  });

});

describe('Resource', function() {

  describe('# one resource', function() {

    describe('meta info', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/[users]/[:id]', { id: 512 });
      });

      it ('holds correct cache info', function() {
        expect(resource.__cache.resourceName).toEqual('users');
        expect(resource.__cache.resourceId).toEqual(512);
        expect(resource.__cache.key).toEqual('users/512');
      });

      it ('holds an object as data', function() {
        expect(resource.data).toEqual(jasmine.any(Object));
        expect(resource._type).toEqual('object');
      });

      it ('as default it is not ready', function() {
        expect(resource.ready).toBe(false);
      });

      it ('as default it does not contain any errors', function() {
        expect(resource.error).toBe(null);
      });

      it ('as default it is not empty (because we dont know yet)', function() {
        expect(resource.isEmpty()).toBe(false);
      });

      it ('sets a timestamp', function() {
        expect(resource._updatedTimestamp).toEqual(jasmine.any(Number));
        expect(resource._createdTimestamp).toEqual(jasmine.any(Number));
        expect(resource._createdTimestamp).not.toEqual(0);
        expect(resource._updatedTimestamp).not.toEqual(0);
      });

    });

    describe('requests', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/[users]/[:id]', { id: 512 });
      });

      beforeEach(function() {
        $http.expect( 'GET', API_BASE_PATH + '/users/512' );
        $http.flush();
      });

      afterEach(function() {
        $http.verifyNoOutstandingExpectation();
        $http.verifyNoOutstandingRequest();
      });

      it ('fetches a single resource from the server', function() {
        expect(resource.data.id).toEqual(512);
        expect(resource.data.name).toEqual('Henry');
      });

      it ('doesnt send a http request when resource is already cached', function() {
        var another_resource = Resource('/[users]/[:id]', { id: 512 });
        expect(another_resource.data.id).toEqual(512);
        expect(another_resource.data.name).toEqual('Henry');
      });

      it ('but it can also force a request', function() {
        var another_resource = Resource('/[users]/[:id]', { id: 512 });
        another_resource.fetch();
        $http.expect( 'GET', API_BASE_PATH + '/users/512' );
        $http.flush();
        expect(another_resource.data.id).toEqual(512);
        expect(another_resource.data.name).toEqual('Henry');
      });

    });

    describe('promised requests', function() {

      var result;

      beforeEach(function() {
        Resource('/[users]/[:id]', { id: 12 }).promise().then(function(pResult) {
          result = pResult;
        });
        $http.expect( 'GET', API_BASE_PATH + '/users/12' );
        $http.flush();
      });

      afterEach(function() {
        $http.verifyNoOutstandingExpectation();
        $http.verifyNoOutstandingRequest();
      });

      it ('fetches a single resource from the server', function() {
        expect(result.data.id).toEqual(12);
        expect(result.data.name).toEqual('Peter');
      });

    });

  });

  describe('# all resources', function() {

    describe('meta info', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/[users]/', null, { isArray: true });
      });

      it ('holds correct cache info', function() {
        expect(resource.__cache.resourceName).toEqual('users');
        expect(resource.__cache.resourceId).toEqual(undefined);
        expect(resource.__cache.key).toEqual('users');
      });

      it ('holds array data', function() {
        expect(resource.data).toEqual(jasmine.any(Array));
      });

    });

    describe('request', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/[users]/', null, { isArray: true });
        $http.expect( 'GET', API_BASE_PATH + '/users/' );
        $http.flush();
      });

      afterEach(function() {
        $http.verifyNoOutstandingExpectation();
        $http.verifyNoOutstandingRequest();
      });

      it ('fetches all resources from the server', function() {
        expect(resource.data).toEqual(resourcesMock.users);
      });

      it ('populates the cache for further single resource requests', function() {
        var another_resource = Resource('/[users]/[:id]', { id: 42 });
        expect(another_resource.data.id).toEqual(42);
        expect(another_resource.data.name).toEqual('Helmut');
      });

    });

  });

  describe('# collection resources', function() {

    describe('meta info', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/[users]{:id}', { id: [42, 712, 12, 712] });
      });

      it ('holds correct cache info', function() {
        expect(resource.__cache.resourceName).toEqual('users');
        expect(resource.__cache.resourceId).toEqual(undefined);
        expect(resource.__cache.collection).toEqual([12, 42, 712]);
        expect(resource.__cache.collectionKey).toEqual('id');
      });

      it ('holds array data', function() {
        expect(resource.data).toEqual(jasmine.any(Array));
      });

    });

    describe('request', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/[users]{:id}', { id: [42, 712, 12, 712] });
        $http.expect( 'GET', API_BASE_PATH + '/users?id[]=12&id[]=42&id[]=712' );
        $http.flush();
      });

      afterEach(function() {
        $http.verifyNoOutstandingExpectation();
        $http.verifyNoOutstandingRequest();
      });

      it ('fetches a resource collection from the server', function() {
        expect(resource.data[0]).toEqual(resourcesMock.users[1]);
        expect(resource.data[1]).toEqual(resourcesMock.users[3]);
        expect(resource.data[2]).toEqual(resourcesMock.users[2]);
        expect(resource.data[3]).toEqual(undefined);
      });

      it ('populates the cache correctly so we can access single resources directly', function() {
        var single_resource = Resource('/[users]/[:id]', { id: 712 });
        expect(single_resource.data.name).toEqual('Paul');
        var another_single_resource = Resource('/[users]/[:id]', { id: 12 });
        expect(another_single_resource.data.name).toEqual('Peter');
      });

    });

  });

});
