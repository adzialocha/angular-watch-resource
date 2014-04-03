'use strict';

var API_BASE_PATH = 'https://api.myservice.de';
var DEFAULT_HEADERS = { 'auth_token': 'some_secret_token' };
var ERROR_MESSAGE = { message: 'a error message', code: 1223 };

var resourcesMock = {
  users: [
    { id: 512, name: 'Henry' },
    { id: 12, name: 'Peter' },
    { id: 712, name: 'Paul' },
    { id: 42, name: 'Helmut' }
  ],
  pages: [
    { id: 100, slug: 'a' },
    { id: 101, slug: 'b' },
    { id: 102, slug: 'c' }
  ],
  cities: [
    { id: 122, name: 'Berlin' },
    { id: 123, name: 'Warszawa' },
    { id: 124, name: 'London' },
    { id: 125, name: 'Helsinki' }
  ],
  countries: [
    { id: 122, name: 'Germany' },
    { id: 123, name: 'Poland' }
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

    $http.when( 'GET', API_BASE_PATH + '/users_wrong/512' ).respond(404, ERROR_MESSAGE );

    var sideloadData = {
      users: resourcesMock.users,
      all_cities: resourcesMock.cities,
      countries: resourcesMock.countries
    };

    $http.when( 'GET', API_BASE_PATH + '/continents' ).respond(200, sideloadData);

    var collection = [
      resourcesMock.users[1],
      resourcesMock.users[3],
      resourcesMock.users[2]
    ];

    $http.when( 'GET', API_BASE_PATH + '/users?id[]=12&id[]=42&id[]=712').respond(200, collection);
    $http.when( 'GET', API_BASE_PATH + '/pages?slug[]=a&slug[]=b&slug[]=c').respond(200, resourcesMock.pages);
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

describe('ResourceService', function() {

  describe('#one', function() {

    describe('return object (Resource)', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('books/:id/pages/:page', { id: 424, page: 12 }).one('pages');
      });

      it ('holds the correct resource name', function() {
        expect(resource.$resourceName).toEqual('pages');
      });

      it ('holds the correct url', function() {
        expect(resource.$url).toEqual(API_BASE_PATH + '/books/424/pages/12');
      });

      it ('holds an object as data', function() {
        expect(resource.data).toEqual(jasmine.any(Object));
      });

      it ('has a timestamp', function() {
        expect(resource.$updatedTimestamp).toEqual(jasmine.any(Number));
        expect(resource.$createdTimestamp).toEqual(jasmine.any(Number));
        expect(resource.$createdTimestamp).not.toEqual(0);
        expect(resource.$updatedTimestamp).not.toEqual(0);
      });

    });

    describe('#fetch', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/users/:id', { id: 512 }).one('users');
      });

      beforeEach(function() {
        $http.expect( 'GET', API_BASE_PATH + '/users/512' );
        $http.flush();
      });

      afterEach(function() {
        $http.verifyNoOutstandingExpectation();
        $http.verifyNoOutstandingRequest();
      });

      it ('a single resource from the server', function() {
        expect(resource.data.id).toEqual(512);
        expect(resource.data.name).toEqual('Henry');
      });

      it ('are not needed when resource is already cached', function() {
        var another_resource = Resource('/users/:id', { id: 512 }).one('users');
        expect(another_resource.data.id).toEqual(512);
        expect(another_resource.data.name).toEqual('Henry');
      });

      it ('can be forced although we have it cached', function() {
        var result;
        var another_resource = Resource('/users/:id', { id: 512 }).one('users');
        another_resource.fetch(function(fResult) { result = fResult; }, null, true);
        $http.expect( 'GET', API_BASE_PATH + '/users/512' );
        $http.flush();
        expect(another_resource.data.id).toEqual(512);
        expect(another_resource.data.name).toEqual('Henry');
        expect(result.data.id).toEqual(512);
        expect(result.data.name).toEqual('Henry');
      });

    });

    describe('#fetch with callback', function() {

      var result;

      beforeEach(function() {
        Resource('/:name/:id', { id: 12, name: 'users' }).one('users').fetch(function(pResult) {
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

    describe('#fetch with sideload option', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/continents').one('continents', {
          sideload: {
            'users': 'users',
            'all_cities': 'cities',
            'countries': 'countries'
          }
        });
      });

      beforeEach(function() {
        $http.expect( 'GET', API_BASE_PATH + '/continents' );
        $http.flush();
      });

      afterEach(function() {
        $http.verifyNoOutstandingExpectation();
        $http.verifyNoOutstandingRequest();
      });

      it ('a sideload resource from the server', function() {
        expect(resource.data.all_cities[1].name).toEqual('Warszawa');
        expect(resource.data.countries[1].name).toEqual('Poland');
      });

      it ('puts its sideload resources into the cache', function() {
        var another_resource = Resource('/cities/:id', { id: 124 }).one('cities');
        expect(another_resource.data.id).toEqual(124);
        expect(another_resource.data.name).toEqual('London');
        var yet_another_resource = Resource('/countries/:id', { id: 122 }).one('countries');
        expect(yet_another_resource.data.id).toEqual(122);
        expect(yet_another_resource.data.name).toEqual('Germany');
      });

    });

    describe('#isReady', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('users/:id', { id: 512 }).one('users');
      });

      it ('returns false at the beginning', function() {
        expect(resource.isReady()).toBe(false);
      });

      it ('returns true after successful server fetch', function() {
        $http.expect( 'GET', API_BASE_PATH + '/users/512' );
        $http.flush();
        expect(resource.isReady()).toBe(true);
      });

    });

    describe('#isEmpty', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('users/:id', { id: 512 }).one('users');
      });

      it ('returns false at the beginning (because we dont know)', function() {
        expect(resource.isEmpty()).toBe(false);
      });

      it ('returns false after successful server fetch', function() {
        $http.expect( 'GET', API_BASE_PATH + '/users/512' );
        $http.flush();
        expect(resource.isEmpty()).toBe(false);
      });

    });

    describe('#isError', function() {

      describe('with successful server request', function() {

        var resource;

        beforeEach(function() {
          resource = Resource('users/:id', { id: 512 }).one('users');
        });

        it ('returns false at the beginning', function() {
          expect(resource.isError()).toBe(false);
        });

        it ('returns false after successful server fetch', function() {
          $http.expect( 'GET', API_BASE_PATH + '/users/512' );
          $http.flush();
          expect(resource.isError()).toBe(false);
        });

      });

      describe('with errror server request', function() {

        var resource;

        beforeEach(function() {
          resource = Resource('users_wrong/:id', { id: 512 }).one('users');
        });

        it ('returns true after wrong server fetch', function() {
          $http.expect( 'GET', API_BASE_PATH + '/users_wrong/512' );
          $http.flush();
          expect(resource.isError()).toBe(true);
        });

      });

    });

    describe('#message', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('users_wrong/:id', { id: 512 }).one('users');
      });

      it ('returns the first message after wrong server fetch', function() {
        $http.expect( 'GET', API_BASE_PATH + '/users_wrong/512' );
        $http.flush();
        expect(resource.message()).toEqual(ERROR_MESSAGE);
      });

    });

  });

  describe('#all', function() {

    describe('return object (Resource)', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/users/').all('users');
      });

      it ('holds correct resource name', function() {
        expect(resource.$resourceName).toEqual('users');
      });

      it ('holds array data', function() {
        expect(resource.data).toEqual(jasmine.any(Array));
      });

    });

    describe('#fetch', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/users/').all('users');
        $http.expect( 'GET', API_BASE_PATH + '/users/' );
        $http.flush();
      });

      afterEach(function() {
        $http.verifyNoOutstandingExpectation();
        $http.verifyNoOutstandingRequest();
      });

      it ('fetch all resources from the server', function() {
        expect(resource.data).toEqual(resourcesMock.users);
      });

      it ('populate the cache for further single resource requests', function() {
        var another_resource = Resource('/users/:id', { id: 42 }).one('users');
        expect(another_resource.data.id).toEqual(42);
        expect(another_resource.data.name).toEqual('Helmut');
      });

    });

  });

  describe('#collection', function() {

    describe('return object (Resource)', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/users').collection('users', [ 42, 712, 12, 712 ]);
      });

      it ('holds correct resource name', function() {
        expect(resource.$resourceName).toEqual('users');
      });

      it ('holds array data', function() {
        expect(resource.data).toEqual(jasmine.any(Array));
      });

    });

    describe('requests', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/users').collection('users', [ 42, 712, 12, 712 ]);
        $http.expect( 'GET', API_BASE_PATH + '/users?id[]=12&id[]=42&id[]=712' );
        $http.flush();
      });

      afterEach(function() {
        $http.verifyNoOutstandingExpectation();
        $http.verifyNoOutstandingRequest();
      });

      it ('fetch a resource collection from the server', function() {
        expect(resource.data[0]).toEqual(resourcesMock.users[1]);
        expect(resource.data[1]).toEqual(resourcesMock.users[3]);
        expect(resource.data[2]).toEqual(resourcesMock.users[2]);
        expect(resource.data[3]).toEqual(undefined);
      });

      it ('populate the cache correctly so we can access single resources directly', function() {
        var single_resource = Resource('/users/:id', { id: 712 }).one('users');
        expect(single_resource.data.name).toEqual('Paul');
        var another_single_resource = Resource('/users/:id', { id: 12 }).one('users');
        expect(another_single_resource.data.name).toEqual('Peter');
      });

    });

    describe('requests with individual collection key', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/pages').collection('pages', [ 'a', 'b', 'c' ], 'slug');
        $http.expect( 'GET', API_BASE_PATH + '/pages?slug[]=a&slug[]=b&slug[]=c' );
        $http.flush();
      });

      afterEach(function() {
        $http.verifyNoOutstandingExpectation();
        $http.verifyNoOutstandingRequest();
      });

      it ('populate the cache correctly so we can access single resources directly', function() {
        var single_resource = Resource('/pages/:id', { id: 100 }).one('pages');
        expect(single_resource.data.slug).toEqual('a');
        var another_single_resource = Resource('/pages/:id', { id: 102 }).one('pages');
        expect(another_single_resource.data.slug).toEqual('c');
      });

    });

  });

});
