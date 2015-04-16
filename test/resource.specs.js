'use strict';

var API_BASE_PATH = 'https://api.myservice.de';
var DEFAULT_HEADERS = { 'auth_token': 'some_secret_token' };
var ERROR_MESSAGE = { message: 'a error message', code: 1223 };

var resourcesMock = {
  users: [
    { id: 512, name: 'Henry',  },
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
  ],
  events: [
    { id: 10, production_id: 2, organization_id: 6, attendances_user_ids: [ 12, 512 ] },
    { id: 81, production_id: 5, organization_id: 7, attendances_user_ids: [ 512 ] },
    { id: 91, production_id: 12, organization_id: 8, attendances_user_ids: [ 712, 42 ] }
  ],
  productions: [
    { id: 2 },
    { id: 5 },
    { id: 12 }
  ],
  organizations: [
    { id: 6 },
    { id: 7 },
    { id: 8 }
  ],
  organizationsWithDataKey: {
    organizations: [
      { id: 6 },
      { id: 7 },
      { id: 8 }
    ]
  }
};

var editableResourceMock = {
  original: { id: 2001, text: 'This is a text.', subject: 'Hello World' },
  edited: { id: 2001, text: 'This is a edited text.', subject: 'Hello World' }
};

var Resource, ResourceConfiguration, $http, $interval;

beforeEach(function () {

  module('resource.service', function(ResourceConfigurationProvider) {
    ResourceConfigurationProvider.setBasePath(API_BASE_PATH);
    ResourceConfigurationProvider.setDefaultHeaders(DEFAULT_HEADERS);
  });

  inject(function (_Resource_, _ResourceConfiguration_, $httpBackend, _$interval_) {
    Resource = _Resource_;
    ResourceConfiguration = _ResourceConfiguration_;
    $http = $httpBackend;
    $interval = _$interval_;

    $http.when( 'GET', API_BASE_PATH + '/users/' ).respond(200, resourcesMock.users);

    $http.when( 'GET', API_BASE_PATH + '/users/512' ).respond(200, resourcesMock.users[0]);
    $http.when( 'GET', API_BASE_PATH + '/users/12' ).respond(200, resourcesMock.users[1]);
    $http.when( 'GET', API_BASE_PATH + '/users/712' ).respond(200, resourcesMock.users[2]);
    $http.when( 'GET', API_BASE_PATH + '/users/42' ).respond(200, resourcesMock.users[3]);

    $http.when( 'GET', API_BASE_PATH + '/cities/122' ).respond(200, resourcesMock.cities[0]);
    $http.when( 'GET', API_BASE_PATH + '/cities/123' ).respond(200, resourcesMock.cities[1]);
    $http.when( 'GET', API_BASE_PATH + '/cities/124' ).respond(200, resourcesMock.cities[2]);

    $http.when( 'GET', API_BASE_PATH + '/users_wrong/512' ).respond(404, ERROR_MESSAGE );

    var sideloadData = {
      users: resourcesMock.users,
      all_cities: resourcesMock.cities,
      countries: resourcesMock.countries
    };

    $http.when( 'GET', API_BASE_PATH + '/continents' ).respond(200, sideloadData);

    var sideloadDataWithKey = {
      included: {
        users: resourcesMock.users,
        all_cities: resourcesMock.cities,
        countries: resourcesMock.countries
      }
    };

    $http.when( 'GET', API_BASE_PATH + '/continents_with_key' ).respond(200, sideloadDataWithKey);

    var collection = [
      resourcesMock.users[1],
      resourcesMock.users[3],
      resourcesMock.users[2]
    ];

    $http.when( 'GET', API_BASE_PATH + '/users?id[]=512' ).respond(200, [ resourcesMock.users[0] ] );
    $http.when( 'GET', API_BASE_PATH + '/users?id[]=12&id[]=42&id[]=712').respond(200, collection);
    $http.when( 'GET', API_BASE_PATH + '/pages?slug[]=a&slug[]=b&slug[]=c').respond(200, resourcesMock.pages);

    $http.when( 'POST', API_BASE_PATH + '/messages/2001/edit' ).respond(200, editableResourceMock.edited);
    $http.when( 'GET', API_BASE_PATH + '/messages/2001' ).respond(200, editableResourceMock.original);

    $http.when( 'GET', API_BASE_PATH + '/events' ).respond(200, resourcesMock.events);
    $http.when( 'GET', API_BASE_PATH + '/productions?id[]=2&id[]=5&id[]=12' ).respond(200, resourcesMock.productions);
    $http.when( 'GET', API_BASE_PATH + '/organizations?id[]=6&id[]=7&id[]=8' ).respond(200, resourcesMock.organizations);
    $http.when( 'GET', API_BASE_PATH + '/users?id[]=12&id[]=42&id[]=512&id[]=712' ).respond(200, resourcesMock.users);

    $http.when( 'GET', API_BASE_PATH + '/organizations_with_data_key' ).respond(200, resourcesMock.organizationsWithDataKey);

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

    describe('#fetch with sideload and sideloadKey option', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/continents_with_key').one('continents', {
          sideload: {
            'users': 'users',
            'all_cities': 'cities',
            'countries': 'countries'
          },
          sideloadKey: 'included'
        });
      });

      beforeEach(function() {
        $http.expect( 'GET', API_BASE_PATH + '/continents_with_key' );
        $http.flush();
      });

      afterEach(function() {
        $http.verifyNoOutstandingExpectation();
        $http.verifyNoOutstandingRequest();
      });

      it ('a sideload resource with key from the server', function() {
        expect(resource.data.included.all_cities[1].name).toEqual('Warszawa');
        expect(resource.data.included.countries[1].name).toEqual('Poland');
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

    describe('fetch with interval option', function() {

      describe('resource with interval option', function() {

        var resource;

        beforeEach(function() {
          resource = Resource('/users/:id', { id: 512 }).one('users', {
            interval: 50
          });
          $http.expect( 'GET', API_BASE_PATH + '/users/512' );
          $http.flush();
        });

        it ('fetches data from the server with every interval step', function() {

          $http.expect( 'GET', API_BASE_PATH + '/users/512' );
          $interval.flush(50);
          $http.flush();
          $http.expect( 'GET', API_BASE_PATH + '/users/512' );
          $interval.flush(50);
          $http.flush();
          $http.expect( 'GET', API_BASE_PATH + '/users/512' );
          $interval.flush(50);
          $http.flush();

        });

        it ('resource #stop interval', function() {
          $http.expect( 'GET', API_BASE_PATH + '/users/512' );
          $interval.flush(50);
          $http.flush();
          resource.stop();
          $interval.flush(50);
        });

        it ('resource #start interval with new frequency', function() {
          $http.expect( 'GET', API_BASE_PATH + '/users/512' );
          $interval.flush(50);
          $http.flush();
          resource.start(1000);
          $interval.flush(50);
          $interval.flush(50);
          $http.expect( 'GET', API_BASE_PATH + '/users/512' );
          $interval.flush(900);
          $http.flush();
        });

      });

      describe('resource #start interval', function() {

        var resource;

        beforeEach(function() {
          resource = Resource('/users/:id', { id: 512 }).one('users');
          $http.expect( 'GET', API_BASE_PATH + '/users/512' );
          $http.flush();
        });

        it ('fetches data from the server with every interval step', function() {

          resource.start(125);

          $http.expect( 'GET', API_BASE_PATH + '/users/512' );
          $interval.flush(125);
          $http.flush();
          $http.expect( 'GET', API_BASE_PATH + '/users/512' );
          $interval.flush(125);
          $http.flush();

        });

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

    describe('#fetch with data key', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/organizations_with_data_key').all('organizations', {
          dataKey: 'organizations'
        });
        $http.expect( 'GET', API_BASE_PATH + '/organizations_with_data_key' );
        $http.flush();
      });

      afterEach(function() {
        $http.verifyNoOutstandingExpectation();
        $http.verifyNoOutstandingRequest();
      });

      it ('fetch all resources from the server', function() {
        expect(resource.data).toEqual(resourcesMock.organizationsWithDataKey.organizations);
      });

      it ('populate the cache for further single resource requests', function() {
        var another_resource = Resource('/organizations/:id', { id: 6 }).one('organizations');
        expect(another_resource.data.id).toEqual(6);
      });

    });

    describe('#fetch with nested option', function() {

      var resource;

      beforeEach(function() {

        resource = Resource('/:res', { res: 'events' }).all('events', {
          nested: {
            'productions':   'production_id',
            'organizations': 'organization_id',
            'users':         'attendances_user_ids'
          }
        });

        $http.expect( 'GET', API_BASE_PATH + '/events' );
        $http.expect( 'GET', API_BASE_PATH + '/productions?id[]=2&id[]=5&id[]=12' );
        $http.expect( 'GET', API_BASE_PATH + '/organizations?id[]=6&id[]=7&id[]=8' );
        $http.expect( 'GET', API_BASE_PATH + '/users?id[]=12&id[]=42&id[]=512&id[]=712' );

        $http.flush();

      });

      afterEach(function() {
        $http.verifyNoOutstandingExpectation();
        $http.verifyNoOutstandingRequest();
      });

      it ('fetch a resource build from the server', function() {
        expect(resource.data[0]).toEqual(resourcesMock.events[0]);
        expect(resource.data[1]).toEqual(resourcesMock.events[1]);
        expect(resource.data[2]).toEqual(resourcesMock.events[2]);
        expect(resource.data[3]).toEqual(undefined);
      });

      it ('populate the cache correctly so we can access single resources directly', function() {
        var single_resource = Resource('/users/:id', { id: 712 }).one('users');
        expect(single_resource.data.name).toEqual('Paul');
        var another_single_resource = Resource('/organizations/:id', { id: 8 }).one('organizations');
        expect(another_single_resource.data.id).toEqual(8);
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

    describe('optimized requests', function() {

      var resource;

      beforeEach(function() {
        resource = Resource('/users').collection('users', [ 712, 42, 12 ]);
        $http.expect( 'GET', API_BASE_PATH + '/users?id[]=12&id[]=42&id[]=712' );
        $http.flush();
      });

      afterEach(function() {
        $http.verifyNoOutstandingExpectation();
        $http.verifyNoOutstandingRequest();
      });

      it ('gets parts of the collection from cache, others from the server', function() {

        var another_resource = Resource('users').collection('users', [ 512, 712, 42, 12 ]);

        $http.expect( 'GET', API_BASE_PATH + '/users?id[]=512' );
        $http.flush();

        expect(another_resource.data[0]).toEqual(resourcesMock.users[0]);
        expect(another_resource.data[1]).toEqual(resourcesMock.users[1]);
        expect(another_resource.data[2]).toEqual(resourcesMock.users[3]);
        expect(another_resource.data[3]).toEqual(resourcesMock.users[2]);

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

  // ==========================================

  describe('#send', function() {

    var request;
    var resource;

    beforeEach(function() {
      resource = Resource('/messages/:id', { id: 2001 }).one('messages');
      $http.expect( 'GET', API_BASE_PATH + '/messages/2001' );
      $http.flush();

      request = Resource('/messages/:id/edit', { id: 2001 }).send({ method: 'POST' }, {
        name: 'messages',
        id: 2001,
        manipulate: function(msg) {
          msg.text = 'This is a edited text.';
        }
      }, 'messages');
    });

    it ('manipulates the data before server is being informed', function() {
      expect(resource.data.subject).toEqual('Hello World');
      expect(resource.data.text).toEqual('This is a edited text.');
    });

    it ('changes the data of all watching resources after fetch', function() {
      $http.expect( 'POST', API_BASE_PATH + '/messages/2001/edit' );
      $http.flush();
      expect(resource.data.text).toEqual('This is a edited text.');
    });

  });

  describe('#reset', function() {

    beforeEach(function() {
      Resource('/continents').one('continents', {
        sideload: {
          'users': 'users',
          'all_cities': 'cities',
          'countries': 'countries'
        }
      });

      $http.expect( 'GET', API_BASE_PATH + '/continents' );
      $http.flush();
    });

    afterEach(function() {
      $http.verifyNoOutstandingExpectation();
      $http.verifyNoOutstandingRequest();
    });

    it ('empties the whole cache', function() {
      Resource().reset();
      Resource('/cities/:id', { id: 124 }).one('cities');
      Resource('/users/:id', { id: 12 }).one('users');
      $http.expect( 'GET', API_BASE_PATH + '/cities/124' );
      $http.expect( 'GET', API_BASE_PATH + '/users/12' );
      $http.flush();
    });

    it ('empties a single cache resource', function() {
      Resource().reset('/users/712');
      Resource('/cities/:id', { id: 124 }).one('cities');
      Resource('/users/:id', { id: 712 }).one('users');
      $http.expect( 'GET', API_BASE_PATH + '/users/712' );
      $http.flush();
    });

    it ('empties a single cache resource with two arguments', function() {
      Resource().reset('users', 712);
      Resource('/cities/:id', { id: 124 }).one('cities');
      Resource('/users/:id', { id: 712 }).one('users');
      $http.expect( 'GET', API_BASE_PATH + '/users/712' );
      $http.flush();
    });

    it ('empties a collection of cache resources', function() {

      Resource().reset('cities', [124, 123, 122]);
      Resource('/cities/:id', { id: 125 }).one('cities');

      Resource('/cities/:id', { id: 123 }).one('cities');
      Resource('/cities/:id', { id: 124 }).one('cities');
      Resource('/cities/:id', { id: 122 }).one('cities');

      $http.expect( 'GET', API_BASE_PATH + '/cities/123' );
      $http.expect( 'GET', API_BASE_PATH + '/cities/124' );
      $http.expect( 'GET', API_BASE_PATH + '/cities/122' );
      $http.flush();

    });

  });

  describe('#debug', function() {

    it ('exists and returns some kind of something', function() {
      expect(Resource().debug()).toEqual(jasmine.any(Object));
    });

  });

});
