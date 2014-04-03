(function(window, angular, undefined) {

  'use strict';

  // @ ngWatchResource

  var ngWatchResource = angular.module('ngWatchResource', []);

  /* @ ResourceConfigurationProvider
   * configuration of service */

  ngWatchResource.provider('ResourceConfiguration', [ function() {

    var _configuration = {
      basePath: '',
      defaultData: {},
      defaultParams: {},
      defaultHeaders: {}
    };

    var ResourceConfiguration = {
      setBasePath: function(bPath) {
        if (bPath && typeof bPath === 'string') {
          _configuration.basePath = bPath;
        }
      },
      setDefaultData: function(bData) {
        if (bData && angular.isObject(bData)) {
          _configuration.defaultData = bData;
        }
      },
      setDefaultParams: function(bParams) {
        if (bParams && angular.isObject(bParams)) {
          _configuration.defaultParams = bParams;
        }
      },
      setDefaultHeaders: function(bHeaders) {
        if (bHeaders && angular.isObject(bHeaders)) {
          _configuration.defaultHeaders = bHeaders;
        }
      },
      $get: function () {
        return {
          basePath: _configuration.basePath,
          defaultData: _configuration.defaultData,
          defaultParams: _configuration.defaultParams,
          defaultHeaders: _configuration.defaultHeaders
        };
      }
    };

    return ResourceConfiguration;

  }]);

  /* @ ResourceService */

  ngWatchResource.factory('Resource', [ '$cacheFactory', '$http', '$q', '$timeout', 'ResourceConfiguration',
    function($cacheFactory, $http, $q, $timeout, ResourceConfiguration) {

    /* Constants */

    var ID_KEY = 'id';

    var DEFAULT_COLLECTION_KEY = 'id';
    var DEFAULT_ARRAY = [];
    var DEFAULT_OBJECT = {};

    var TYPE_ALL = 0;
    var TYPE_ONE = 1;
    var TYPE_COLLECTION = 2;

    var STATUS_INITALIZED = 10;
    var STATUS_LOADING = 20;
    var STATUS_FETCHED = 30;
    var STATUS_ERROR = 40;

    /* Globals */

    var defaultOptions = {
      // updateInterval: 0,
      silent: false,
      withCredentials: false,
      responseType: 'json',
      method: 'GET',
      data: angular.copy(ResourceConfiguration.defaultData),
      params: angular.copy(ResourceConfiguration.defaultParams),
      headers: angular.copy(ResourceConfiguration.defaultHeaders)
    };

    var __debug = {};

    /* @ Global Helpers */

    var _ = {};

    // strip all duplicates from array

    _.unique = function(cArray) {
      return cArray.filter(function(value, index, self) {
        return self.indexOf(value) === index;
      });
    };

    // generate a hash from a string

    _.hash = function(hString) {
      var hash, i, len;
      hash = 0;
      len = hString.length;
      if (len === 0) {
        return hash;
      }
      for (i = 0; i < len; i++) {
        hash = ( ( hash << 5 ) - hash ) + hString.charCodeAt(i);
        hash = hash & hash;
      }
      return hash.toString();
    };

    // replaces new values for given keys

    _.update = function(eSource, eDestination) {

      var extended = angular.copy(eSource);

      if (eDestination) {
        angular.forEach(Object.keys(eDestination), function(oKey) {
          if (oKey in extended && typeof extended[oKey] === typeof eDestination[oKey]) {
            if (angular.isObject(extended[oKey])) {
              extended[oKey] = angular.extend(extended[oKey], eDestination[oKey]);
            } else {
              extended[oKey] = eDestination[oKey];
            }
          }
        });
      }

      return extended;
    };

    // returns the current timestamp

    _.now = function() {
      var date = new Date();
      return date.getTime();
    };

    // checks if the given object is empty

    _.isEmpty = function(eTarget) {
      if (eTarget) {
        if (angular.isArray(eTarget)) {
          return angular.equals(DEFAULT_ARRAY, eTarget);
        } else {
          return angular.equals(DEFAULT_OBJECT, eTarget);
        }
      } else {
        return true;
      }
    };

    // get the value of a key from all elements in the collection

    _.pluck = function(eCollection, eIdentifier) {
      var values = [];
      angular.forEach(eCollection, function(eItem) {
        if (eIdentifier in eItem) {
          values.push(eItem[eIdentifier]);
        }
      });
      return values;
    };

    // serialize a string

    _.serialize = function(sParams) {
      var paramArray, serialized;

      paramArray = [];
      serialized = '';

      angular.forEach(Object.keys(sParams), function(pKey) {
        if (sParams.hasOwnProperty(pKey)) {
          if (angular.isArray(sParams[pKey])) {
            angular.forEach(sParams[pKey], function(eArrayItem) {
              paramArray.push(encodeURIComponent(pKey) + '[]=' + eArrayItem);
            });
          } else {
            paramArray.push(encodeURIComponent(pKey) + '=' + encodeURIComponent(sParams[pKey]));
          }
        }
      });

      if (paramArray.length > 0) {
        serialized = '?' + paramArray.join('&');
      }

      return serialized;
    };

    /* @ Cache
     *
     * wrapper around $cacheFactory with extended methods like
     * an exists or update function to change data from the resources.
     */

    var Cache = function(cName) {
      __debug[cName] = {};
      this.name = cName;
      this.storage = $cacheFactory(cName);
    };

    Cache.prototype = {

      // basic methods

      exists: function(pCacheKey) {
        return angular.isDefined(this.storage.get(pCacheKey));
      },
      get: function(pCacheKey) {
        return this.storage.get(pCacheKey);
      },
      set: function(pCacheKey, pCacheData) {
        __debug[this.name][pCacheKey] = pCacheData;
        return this.storage.put(pCacheKey, pCacheData);
      },

      // update data and timestamp from element

      update: function(pCacheKey, pCacheData) {
        /* jshint camelcase: false */
        var data = this.get(pCacheKey);
        data.$_updatedTimestamp = _.now();
        data.data = pCacheData;
        return this.storage.put(pCacheKey, data);
      }

    };

    // main caches

    // the resourceCache holds the public Resource objects
    // we are watching from the outside. The atomicCache is the
    // internal storage for single resources like /resource/:id

    var resourceCache = new Cache('__resourceCache');
    var atomicCache = new Cache('__atomicCache');

    /* @ CacheUtils */

    var CacheUtils = {};

    /* @ CacheUtils.Resource
     *
     * methods for our resourceCache
     */

    CacheUtils.Resource = {

      // main method to build data for Resource objects based
      // on an array of atomic keys so we can read the data
      // from the atomic resources to put them together into one Resource.

      buildData: function(rPointer, rAtomicCacheKeys) {

        var data;

        if (rAtomicCacheKeys.length === 0) {
          return false;
        }

        if (rPointer._data.type === TYPE_ONE) {
          data = atomicCache.get(rAtomicCacheKeys[0]).data;
        } else {
          data = [];
          angular.forEach(rAtomicCacheKeys, function(aKey) {
            data.push(atomicCache.get(aKey).data);
          });
        }

        resourceCache.update(rPointer.cacheKey, data);

        return true;
      }

    };

    /* @ CacheUtils.Atomic
     *
     * helper methods for our atomicCache
     */

    CacheUtils.Atomic = {

      // updates a atomic resource, when not given create it

      _insertData: function(cResourceName, cObject) {
        if (! (ID_KEY in cObject)) {
          throw 'CacheUtilsError: cant find ID key in object.';
        }

        var pointer = new ResourcePointer().build(cResourceName, cObject[ID_KEY]);
        pointer.parseCacheKey();

        if (! atomicCache.exists(pointer.cacheKey)) {
          var atomic = new AtomicResource(cResourceName, cObject[ID_KEY]);
          atomicCache.set(pointer.cacheKey, atomic);
        }

        atomicCache.update(pointer.cacheKey, cObject);
        return pointer.cacheKey;
      },

      // returns an array with atomic cache keys

      cacheKeyArray: function (cDataArray, cResourceName) {
        var cacheKeys = [];
        angular.forEach(cDataArray, function(dItem) {
          var pointer = new ResourcePointer().build(cResourceName, dItem);
          cacheKeys.push(pointer.parseCacheKey());
        });
        return cacheKeys;
      },

      // returns an array of ids which cant be found in cache

      findUncached: function(cDataArray, cResourceName) {
        return cDataArray.filter(function(eIdItem) {
          var pointer = new ResourcePointer().build(cResourceName, eIdItem);
          pointer.parseCacheKey();
          return ! atomicCache.exists(pointer.cacheKey);
        });
      },

      // iterates through an array and places its elements at the right spot in the cache

      populateCache: function(cOptions, cResourceName, cObject) {
        var _this = this;
        var atomicCacheKeys = [];
        if (angular.isArray(cObject)) {
          angular.forEach(cObject, function(eItem) {
            atomicCacheKeys.push(_this._insertData(cResourceName, eItem));
          });
        } else {
          atomicCacheKeys.push(this._insertData(cResourceName, cObject));
        }
        return atomicCacheKeys;
      }

    };

    /* @ AtomicResource
     *
     * smallest cache entity (/resource/:id)
     */

    var AtomicResource = function(rResourceName, rId) {
      this._createdTimestamp = _.now();
      this._updatedTimestamp = this._createdTimestamp;
      this._resourceName = rResourceName;
      this._resourceId = rId;
      this.data = DEFAULT_OBJECT;
    };

    /* @ ResourcePointer
     *
     * holds all the info we need to know to point to
     * an Resource instance (cacheKey) plus meta information
     * we need to process the data (like collection arrays).
     */

    var ResourcePointer = function(rPath, rVars, rData) {
      this._path = rPath || '';
      this._vars = rVars || {};
      this._data = rData || { type: TYPE_ONE };

      this.cacheKey = undefined;
      this.resourcePath = '';
    };

    // returns if given pointer contains a collection

    ResourcePointer.prototype.isCollection = function() {
      return this._data.type === TYPE_COLLECTION;
    };

    // build a single resource pointer

    ResourcePointer.prototype.build = function(rResourceName, rId) {
      this._path = rResourceName + '/:id';
      this._vars[ID_KEY] = rId;
      return this;
    };

    // parse variables and collection data in path to generate a cacheKey

    ResourcePointer.prototype.parseCacheKey = function() {
      var path = this._path;
      var _this = this;

      path = path.replace(/\\:/g, ':');

      if (this._vars) {
        angular.forEach(Object.keys(_this._vars), function(vKey) {
          path = path.replace(new RegExp(':' + vKey, 'g'), _this._vars[vKey]);
        });
      }

      if (path[0] !== '/') {
        path = '/' + path;
      }

      this.resourcePath = path;

      if (this.isCollection()) {
        var hashed = _.hash( this._data.collectionArray.join('.') );
        path = path + '?' + this._data.collectionKey + '=' + hashed;
      }

      this.cacheKey = path;

      return this;
    };

    // serialize url and generate collection data info when given

    ResourcePointer.prototype.serializeUrl = function(sParams, sOptimizedCollectionArray) {
      var params, serialized;

      params = sParams;

      if (this.isCollection()) {
        var collection = {};

        if (this._data.collectionKey in sParams) {
          throw 'ResourcePointerError: collection key already exists as parameter';
        }

        if (sOptimizedCollectionArray) {
          collection[this._data.collectionKey] = sOptimizedCollectionArray;
        } else {
          collection[this._data.collectionKey] = this._data.collectionArray;
        }

        params = angular.extend(collection, sParams);
      }

      serialized = _.serialize(params);

      var basePath = ResourceConfiguration.basePath;

      if (basePath[basePath.length - 1] === '/') {
        basePath = basePath.slice(0, basePath.length - 1);
      }

      return basePath + this.resourcePath + serialized;
    };

    /* @ RequestUtils
     *
     * helper methods to generate and optimize server requests
     */

    var RequestUtils = {};

    // returns a proper object for $http requests

    RequestUtils.build = function(rPointer, rOptions) {
      var url = rPointer.serializeUrl(rOptions.params);
      var request = {
        method: rOptions.method,
        url: url,
        data: rOptions.data,
        headers: rOptions.headers,
        withCredentials: rOptions.withCredentials,
        responseType: rOptions.responseType,
        cache: false
      };
      return request;
    };

    // compares the request with our cache to see if we can make it smaller or dispensable

    RequestUtils.optimize = function(rRequest, rPointer, rOptions, rResourceName) {
      var optimized = {};
      var requestNotNeeded = false;
      var cachedAtomicKeys = [];

      if (rPointer._data.type === TYPE_COLLECTION) {

        var optimizedCollection = CacheUtils.Atomic.findUncached(rPointer._data.collectionArray, rResourceName);
        optimized.url = rPointer.serializeUrl(rOptions.params, optimizedCollection);

        var cachedIds = rPointer._data.collectionArray.filter(function(dItem) {
          return optimizedCollection.indexOf(dItem) === -1;
        });

        cachedAtomicKeys = CacheUtils.Atomic.cacheKeyArray(cachedIds, rResourceName);

        if (_.isEmpty(optimizedCollection)) {
          requestNotNeeded = true;
        }

      } else if (rPointer._data.type === TYPE_ONE) {

        if (atomicCache.exists(rPointer.cacheKey)) {
          cachedAtomicKeys = [ rPointer.cacheKey ];
          requestNotNeeded = true;
        }

      } else if (rPointer._data.type === TYPE_ALL) {

        if (resourceCache.get(rPointer.cacheKey).isReady()) {
          cachedAtomicKeys = _.pluck(resourceCache.get(rPointer.cacheKey).data, ID_KEY);
          requestNotNeeded = true;
        }

      }

      var request = _.update(rRequest, optimized);

      return {
        requestNotNeeded: requestNotNeeded,
        cachedAtomicKeys: cachedAtomicKeys,
        request: request
      };
    };

    /* @ Resource
     *
     * Our public class which is being watched from the outside.
     * Holds all important meta info (creation date, update date) and
     * the data itself, being put together from smaller AtomicResources.
     *
     * Every Resource exposes several public methods the user can work with,
     * for example to manually (force-)fetch data from the server.
     */

    var Resource = function(rPointer, rResourceName, rOptions) {

      /* jshint camelcase: false */

      this.$__meta = {
        pointer: rPointer,
        options: rOptions,
        errors: [],
        status: STATUS_INITALIZED
      };

      // ignored by $watch

      this.$_createdTimestamp = _.now();
      this.$_updatedTimestamp = this.$_createdTimestamp;
      this.$_requestTimestamp = undefined;
      this.$_resourceName = rResourceName;
      this.$_url = rPointer.serializeUrl(rOptions.params);

      // $watch object

      this.data = rPointer._data.type === TYPE_ONE ? DEFAULT_OBJECT : DEFAULT_ARRAY;

    };

    Resource.prototype = {

      /* jshint camelcase: false */

      // method to manually fill in the data (from server or cache), with callbacks

      fetch: function(fSuccess, fError, fDisableOptimization) {

        var _this = this;
        var pointer, options, atomicCacheKeys, request;

        pointer = this.$__meta.pointer;
        options = this.$__meta.options;

        request = RequestUtils.build(pointer, options);

        if (! fDisableOptimization) {

          var optimized = RequestUtils.optimize(request, pointer, options, this.$_resourceName);
          atomicCacheKeys = optimized.cachedAtomicKeys;
          CacheUtils.Resource.buildData(pointer, atomicCacheKeys);

          if (optimized.requestNotNeeded) {

            this.$__meta.status = STATUS_FETCHED;

            // we dont need to ask the server

            if (fSuccess && angular.isFunction(fSuccess)) {
              fSuccess(this);
            }

            return this;

          } else {
            request = optimized.request;
          }
        }

        this.$__meta.status = STATUS_LOADING;

        // fetch data from the server

        $http(request).then(function(fResult) {

          // give data to cache (we dont manipulate our resource directly)

          atomicCacheKeys = CacheUtils.Atomic.populateCache(options, _this.$_resourceName, fResult.data);
          CacheUtils.Resource.buildData(pointer, atomicCacheKeys);

          _this.$_requestTimestamp = _.now();

          // callback

          _this.$__meta.status = STATUS_FETCHED;

          if (fSuccess && angular.isFunction(fSuccess)) {
            fSuccess(_this);
          }

        }, function(fError) {

          _this.$__meta.status = STATUS_ERROR;
          _this.$__meta.errors.push(fError.data);

          if (fError && angular.isFunction(fError)) {
            fError(_this);
          }

        });

        return this;
      },

      // methods for status handling (for example in view)

      isError: function() {
        return this.$__meta.status === STATUS_ERROR;
      },

      isReady: function() {
        return this.$__meta.status === STATUS_FETCHED;
      },

      isEmpty: function() {
        return this.$__meta.status === STATUS_FETCHED && _.isEmpty(this.data);
      },

      // returns the latest error message, set mReturnAll to get all (as array)

      message: function(mReturnAll) {
        var errors = this.$__meta.errors;
        if (errors.length === 0) {
          return undefined;
        } else {
          if (! mReturnAll) {
            return errors[errors.length - 1];
          } else {
            return errors;
          }
        }
      }

    };

    /* @ ResourceFactory
     *
     * routes our paths and resource methods (all, one, collection) to the respective
     * Resource instance. Create one if it doesnt exist yet. There is one Resource
     * per path (not per request!).
     */

    var ResourceFactory = function(rPath, rVars, rResourceName, rOptions, rData) {

      var pointer, data, resource;

      data = rData;

      if (data.type === TYPE_COLLECTION) {
        data.collectionArray = _.unique(data.collectionArray).sort();
      }

      pointer = new ResourcePointer(rPath, rVars, data).parseCacheKey();

      if (! resourceCache.exists(pointer.cacheKey)) {
        var options = _.update(defaultOptions, rOptions);
        resource = new Resource(pointer, rResourceName, options);
        resourceCache.set(pointer.cacheKey, resource);
        if (! options.silent) {
          resource.fetch(false);
        }
      } else {
        resource = resourceCache.get(pointer.cacheKey);
      }

      return resource;

    };

    /* @ ResourceService
     *
     * exposes all available methods from the service
     */

    var ResourceService = function(rPath, rVars) {

      var vars = rVars || {};

      function _delegate(rResourceName, rOptions, rData) {

        var options;

        if (! rPath) {
          throw 'ResourceServiceError: path is missing';
        }

        if (! angular.isObject(vars)) {
          throw 'ResourceServiceError: path vars parameter must be an object';
        }

        if (! (rResourceName && typeof rResourceName === 'string')) {
          throw 'ResourceServiceError: resource name is missing or is not a string';
        }

        options = rOptions || {};

        if (! angular.isObject(vars)) {
          throw 'ResourceServiceError: options parameter must be an object';
        }

        return ResourceFactory(rPath, vars, rResourceName, options, rData);
      }

      // public interface

      return {

        // basic watch methods (get)

        all: function(rResourceName, rOptions) {
          return _delegate(rResourceName, rOptions, { type: TYPE_ALL });
        },

        one: function(rResourceName, rOptions) {
          return _delegate(rResourceName, rOptions, { type: TYPE_ONE });
        },

        collection: function(rResourceName, rCollection, rCollectionKey, rOptions) {
          var key;

          if (! (rCollection && angular.isArray(rCollection))) {
            throw 'ResourceServiceError: collection parameter must be an array and not undefined';
          }

          key = rCollectionKey || DEFAULT_COLLECTION_KEY;
          return _delegate(rResourceName, rOptions, { type: TYPE_COLLECTION, collectionKey: key, collectionArray: rCollection });
        },

        // change single resource (delete, post and put) methods

        manipulate: function() {
          // @ TODO
          return false;
        },

        // debug methods

        debug: function() {
          return __debug;
        }

      };

    };

    return ResourceService;

  }]);

})(window, window.angular);
