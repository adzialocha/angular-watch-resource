(function(window, angular, undefined) {

  'use strict';

  // @ ngWatchResource

  var ngWatchResource = angular.module('resource.service', []);

  /* @ ResourceConfigurationProvider
   * configuration of service */

  ngWatchResource.provider('ResourceConfiguration', [ function() {

    var _configuration = {
      basePath: '',
      defaultData: {},
      defaultParams: {},
      defaultHeaders: {}
    };

    var resourceConfiguration = {
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

    return resourceConfiguration;

  }]);

  /* @ Resource */

  ngWatchResource.factory('Resource', [ '$cacheFactory', '$http', '$q', '$interval', 'ResourceConfiguration',
    function($cacheFactory, $http, $q, $interval, ResourceConfiguration) {

    /* Constants */

    var ID_KEY = 'id';
    var FORCED_ID_START = 1;

    var ALLOWED_RETRIEVAL_METHODS = [ 'GET', 'HEAD' ];
    var ALLOWED_MANIPULATION_METHODS = [ 'PUT', 'POST', 'DELETE' ];

    var DEFAULT_MANIPULATION_METHOD = 'POST';

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
      interval: 0,
      silent: false,
      cacheKey: undefined,
      sideload: {},
      nested: {},
      withCredentials: false,
      responseType: 'json',
      method: 'GET',
      data: angular.copy(ResourceConfiguration.defaultData),
      params: angular.copy(ResourceConfiguration.defaultParams),
      headers: angular.copy(ResourceConfiguration.defaultHeaders)
    };

    var _forcedId = FORCED_ID_START;
    var _intervalJobs = {};

    var __debug = {};

    /* @ Global Helpers */

    var _ = {};

    // strip all duplicates from array

    _.unique = function(cArray) {
      return cArray.filter(function(value, index, self) {
        return self.indexOf(value) === index;
      });
    };

    // sort number arrays

    _.sort = function(cArray) {
      return cArray.sort(function(aItem, bItem) {
        return aItem - bItem;
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

    /* @ intervalUtils
     *
     * handles the frequent update of an resource
     */

    var intervalUtils = {};

    // start a $interval, fetching new data in a certain frequency

    intervalUtils.start = function(rResource, rFrequency) {

      /* jshint camelcase: false */

      var _this = this;
      var id = rResource.$__meta.pointer.cacheKey;
      var createNew = false;

      if (! angular.isNumber(rFrequency)) {
        throw 'intervalUtils: interval frequency must be a number';
      }

      // do we need to create a new one (changed frequency)

      if (! (id in _intervalJobs)) {
        createNew = true;
      } else {
        if (_intervalJobs[id].frequency !== rFrequency) {
          this.stop(rResource);
          if (rFrequency > 0) {
            createNew = true;
          }
        }
      }

      if (createNew) {

        _intervalJobs[id] = {
          frequency: rFrequency,
          promise: undefined
        };

        _intervalJobs[id].promise = $interval(function() {

          rResource.fetch(null, function() {
            // cancel $interval when there is an server error happening
            _this.stop(rResource);
          }, true);

        }, rFrequency);

        __debug.__intervals = _intervalJobs;
      }

      return createNew;

    };

    // stop the $interval

    intervalUtils.stop = function(rResource) {

      /* jshint camelcase: false */

      var id = rResource.$__meta.pointer.cacheKey;

      if (! (id in _intervalJobs)) {
        return false;
      }

      $interval.cancel(_intervalJobs[id].promise);
      delete _intervalJobs[id];
      __debug.__intervals = _intervalJobs;

      return true;

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

      update: function(pCacheKey, pCacheData, pUpdateIsLocal) {
        if (! this.exists(pCacheKey)) {
          return null;
        }
        var item = this.get(pCacheKey);
        if (! pUpdateIsLocal) {
          item.$updatedTimestamp = _.now();
        }
        item.data = pCacheData;
        return this.storage.put(pCacheKey, item);
      },

      // reset methods

      resetAll: function() {
        __debug[this.name] = {};
        this.storage.removeAll();
        return true;
      },

      reset: function(rKey) {
        delete __debug[this.name][rKey];
        this.storage.remove(rKey);
        return true;
      }

    };

    // main caches

    // the resourceCache holds the public Resource objects
    // we are watching from the outside. The atomicCache is the
    // internal storage for single resources like /resource/:id

    var resourceCache = new Cache('__resourceCache');
    var atomicCache = new Cache('__atomicCache');

    /* @ cacheUtils */

    var cacheUtils = {};

    /* @ cacheUtils.resource
     *
     * methods for our resourceCache
     */

    cacheUtils.resource = {

      // main method to build data for Resource objects based
      // on an array of atomic keys so we can read the data
      // from the atomic resources to put them together into one Resource.

      buildData: function(rPointer, rAtomicCacheKeys) {

        var data, item;

        if (rAtomicCacheKeys.length === 0) {
          return false;
        }

        if (rPointer._data.type === TYPE_ONE) {
          item = atomicCache.get(rAtomicCacheKeys[0]);
          data = item.data;
        } else {
          data = [];
          angular.forEach(rAtomicCacheKeys, function(aKey) {
            item = atomicCache.get(aKey);
            data.push(item.data);
          });
        }

        resourceCache.update(rPointer.cacheKey, data);

        return true;
      }

    };

    /* @ cacheUtils.atomic
     *
     * helper methods for our atomicCache
     */

    cacheUtils.atomic = {

      // updates a atomic resource, when not given create it

      _insertData: function(cResourceName, cObject) {
        if (! (ID_KEY in cObject)) {
          // give him an (internal) id if resource doesnt have one
          cObject[ID_KEY] = '__internal' + _forcedId;
          _forcedId++;
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

      // fills the atomic cache with data from a sideload resource

      _insertSideloadData: function(cSideloadData, cResources) {
        var _this = this;
        angular.forEach(Object.keys(cSideloadData), function(sKey) {
          if (sKey in cResources && angular.isArray(cResources[sKey])) {
            angular.forEach(cResources[sKey], function(eItem) {
              _this._insertData(cSideloadData[sKey], eItem);
            });
          }
        });
      },

      // returns an array with atomic cache keys

      cacheKeyArray: function (cDataArray, cResourceName) {
        var cacheKeys = [];
        angular.forEach(cDataArray, function(dItem) {
          var pointer = new ResourcePointer().build(cResourceName, dItem);
          pointer.parseCacheKey();
          cacheKeys.push(pointer.cacheKey);
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
          if (! (_.isEmpty(cOptions.sideload))) {
            this._insertSideloadData(cOptions.sideload, cObject);
          }
        }
        return atomicCacheKeys;
      }

    };

    /* @ AtomicResource
     *
     * smallest cache entity (/resource/:id)
     */

    var AtomicResource = function(rResourceName, rId) {
      this.$createdTimestamp = _.now();
      this.$updatedTimestamp = this.$createdTimestamp;
      this.$resourceName = rResourceName;
      this.$resourceId = rId;
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

    // build a collection resource pointer

    ResourcePointer.prototype.buildCollection = function(rResourceName, rIds) {
      this._path = rResourceName;
      this._data = {
        type: TYPE_COLLECTION,
        collectionArray: rIds,
        collectionKey: DEFAULT_COLLECTION_KEY
      };
      return this;
    };

    // parse variables and collection data in path to generate a cacheKey

    ResourcePointer.prototype.parseCacheKey = function(rCustomCacheKey) {
      var path, keys, i, len;

      path = this._path;
      path = path.replace(/\\:/g, ':');

      if (this._vars) {
        keys = Object.keys(this._vars);
        len = keys.length;
        // lets be more performative here, lets take a for instead of a foreach loop
        for (i = 0; i < len; i++) {
          path = path.replace(new RegExp(':' + keys[i], 'g'), this._vars[keys[i]]);
        }
      }

      if (path[0] !== '/') {
        path = '/' + path;
      }

      this.resourcePath = path;

      if (this.isCollection()) {
        var hashed = _.hash(this._data.collectionArray.join('.'));
        path = path + '?' + this._data.collectionKey + '=' + hashed;
      }

      if (rCustomCacheKey) {
        this.cacheKey = rCustomCacheKey;
      } else {
        this.cacheKey = path;
      }

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

    /* @ requestUtils
     *
     * helper methods to generate and optimize server requests
     */

    var requestUtils = {};

    // returns a proper object for $http requests

    requestUtils.build = function(rPointer, rOptions) {
      return {
        method: rOptions.method,
        url: rPointer.serializeUrl(rOptions.params),
        data: rOptions.data,
        headers: rOptions.headers,
        withCredentials: rOptions.withCredentials,
        responseType: rOptions.responseType,
        cache: false
      };
    };

    // compares the request with our cache to see if we can make it smaller or dispensable

    requestUtils.optimize = function(rRequest, rPointer, rOptions, rResourceName) {
      var optimized = {};
      var requestNotNeeded = false;
      var cachedAtomicKeys = [];

      if (rPointer._data.type === TYPE_COLLECTION) {

        var optimizedCollection = cacheUtils.atomic.findUncached(rPointer._data.collectionArray, rResourceName);
        optimized.url = rPointer.serializeUrl(rOptions.params, optimizedCollection);

        var cachedIds = rPointer._data.collectionArray.filter(function(dItem) {
          return optimizedCollection.indexOf(dItem) === -1;
        });

        cachedAtomicKeys = cacheUtils.atomic.cacheKeyArray(cachedIds, rResourceName);

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

      this.$createdTimestamp = _.now();
      this.$updatedTimestamp = this.$createdTimestamp;
      this.$requestTimestamp = undefined;
      this.$resourceName = rResourceName;
      this.$url = rPointer.serializeUrl(rOptions.params);

      // $watch object

      this.data = rPointer._data.type === TYPE_ONE ? DEFAULT_OBJECT : DEFAULT_ARRAY;

    };

    Resource.prototype = {

      /* jshint camelcase: false */

      // method to manually fill in the data (from server or cache), with callbacks

      fetch: function(fSuccess, fError, fDisableOptimization, fDisableCaching) {

        // the server request handler

        function handleRequest(rRequestData, rOptions, rPointer, resourceName) {

          var deferred;

          // we return a promise here

          deferred = $q.defer();

          var request, optimized, pointer, options;
          var atomicCacheKeys, cachedAtomicCacheKeys;

          request = rRequestData;
          options = rOptions;
          pointer = rPointer;

          if (! fDisableOptimization) {
            optimized = requestUtils.optimize(request, pointer, options, resourceName);
            cachedAtomicCacheKeys = optimized.cachedAtomicKeys;

            if (! fDisableCaching) {
              cacheUtils.resource.buildData(pointer, cachedAtomicCacheKeys);
            }

            if (optimized.requestNotNeeded) {
              // we dont need to ask the server
              deferred.resolve(false);
              return deferred.promise;
            } else {
              request = optimized.request;
            }
          }

          // fetch data from the server

          $http(request).then(function(fResult) {

            // give data to cache (we dont manipulate our resource directly)

            if (! fDisableCaching) {
              atomicCacheKeys = cacheUtils.atomic.populateCache(options, resourceName, fResult.data);

              // merge fetched with cached resource cacheKeys when given

              if (cachedAtomicCacheKeys && cachedAtomicCacheKeys.length > 0) {
                atomicCacheKeys = atomicCacheKeys.concat(cachedAtomicCacheKeys);
              }

              cacheUtils.resource.buildData(pointer, atomicCacheKeys);
            }

            deferred.resolve(true);

          }, function(fErrorData) {
            deferred.reject(fErrorData);
          });

          return deferred.promise; // return handleRequest()

        }

        // error callback

        function errorCallback(rResourceInstance, rErrorData) {

          // error occurred

          rResourceInstance.$__meta.status = STATUS_ERROR;
          rResourceInstance.$__meta.errors.push(rErrorData.data);

          if (fError && angular.isFunction(fError)) {
            fError(rResourceInstance);
          }

        }

        // callback handling when everything is done

        function finalizeRequest(rPromises, rResourceInstance) {

          $q.all(rPromises).then(function(rHttpRequestNeeded) {

            // resource is ready

            if (rHttpRequestNeeded) {
              rResourceInstance.$requestTimestamp = _.now();
            }

            rResourceInstance.$__meta.status = STATUS_FETCHED;

            if (fSuccess && angular.isFunction(fSuccess)) {
              fSuccess(rResourceInstance);
            }

          }, function(rErrorData) {
            errorCallback(rResourceInstance, rErrorData);
          });

        }

        // setup requests

        var pointer, options;

        pointer = this.$__meta.pointer;
        options = this.$__meta.options;

        if (! this.isReady()) {
          this.$__meta.status = STATUS_LOADING;
        }

        // generate all needed requests for this fetch (normally one but for
        // nested resource we sometimes need to request more)

        var mainRequest, promises;

        mainRequest = requestUtils.build(pointer, options);

        promises = [];

        promises.push(handleRequest(mainRequest, options, pointer, this.$resourceName));

        // is there more requests to make (in case we got the nested option)?

        if (_.isEmpty(options.nested)) {
          finalizeRequest(promises, this);

        } else {

          var _this = this;

          // then wait for the mainRequest

          promises[0].then(function() {

            promises = [];

            var resourceNames = Object.keys(options.nested);
            var resourceIds = {};

            angular.forEach(resourceNames, function(rName) {
              resourceIds[rName] = [];
            });

            var mainResource = [];

            if (! (angular.isArray(_this.data))) {
              mainResource = [ _this.data ];
            } else {
              mainResource = _this.data;
            }

            // which requests do we have to make?

            angular.forEach(mainResource, function(rItem) {
              angular.forEach(resourceNames, function(eResourceName) {
                var key = options.nested[eResourceName];
                var ids = rItem[key];
                if (! angular.isArray(ids)) {
                  ids = [ ids ];
                }
                resourceIds[eResourceName] = resourceIds[eResourceName].concat(ids);
              });
            });

            // build requests

            angular.forEach(resourceIds, function(rRequestedIds, rRequestedResourceName) {

              var resIds = _.sort(_.unique(rRequestedIds));
              var resOptions = defaultOptions;
              var resPointer;

              if (resIds.length === 1) {
                resPointer = new ResourcePointer().build(rRequestedResourceName, resIds[0]);
              } else {
                resPointer = new ResourcePointer().buildCollection(rRequestedResourceName, resIds);
              }

              resPointer.parseCacheKey();

              var resRequest = requestUtils.build(resPointer, resOptions);

              promises.push(handleRequest(resRequest, resOptions, resPointer, rRequestedResourceName));

            });

            finalizeRequest(promises, _this);

          }, function(eErrorData) {
            errorCallback(_this, eErrorData);
          });

        }

        return this; // return fetch()
      },

      // interval update handling

      start: function(sIntervalFrequency) {
        return intervalUtils.start(this, sIntervalFrequency);
      },

      stop: function() {
        return intervalUtils.stop(this);
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

    /* @ resourceManipulator
     *
     * sends a request to the server and returns a promise. when a local update object
     * is given, change the object directly (to get direct feedback in the view)
     */

    var resourceManipulator = function(rPath, rVars, rOptions, rLocalUpdates) {

      var deferred, pointer, resource, options, resourceName;

      deferred = $q.defer();

      // merge options

      options = rOptions;

      if (! ('method' in options)) {
        options.method = DEFAULT_MANIPULATION_METHOD;
      }

      options = _.update(defaultOptions, options);

      if (ALLOWED_MANIPULATION_METHODS.indexOf(options.method) === -1) {
        throw 'ResourceServiceError: method is not allowed';
      }

      // update local data already before we got server response

      if (! (!(_.isEmpty(rLocalUpdates)) && rLocalUpdates.name && rLocalUpdates.id && rLocalUpdates.manipulate)) {
        throw 'ResourceServiceError: resource manipulation info is missing';
      }

      if (! (angular.isFunction(rLocalUpdates.manipulate))) {
        throw 'ResourceServiceError: manipulate property must be a function';
      }

      var atomic = new ResourcePointer();
      atomic.build(rLocalUpdates.name, rLocalUpdates.id);
      atomic.parseCacheKey();

      if (! _.isEmpty(rLocalUpdates) && atomicCache.exists(atomic.cacheKey)) {
        var data = atomicCache.get(atomic.cacheKey).data;
        resourceName = rLocalUpdates.name;
        rLocalUpdates.manipulate(data);
        atomicCache.update(atomic.cacheKey, data, true);
      }

      // request to server

      pointer = new ResourcePointer(rPath, rVars).parseCacheKey();
      pointer.cacheKey = atomic.cacheKey; // route cache to the resource we want to manipulate

      resource = new Resource(pointer, resourceName || undefined, options);

      resource.fetch(function(){
        deferred.resolve(resource);
      }, function() {
        deferred.reject(resource);
      }, true, resourceName ? false : true);

      return deferred.promise;

    };

    /* @ resourceFactory
     *
     * routes our paths and resource methods (all, one, collection) to the respective
     * Resource instance. Create one if it doesnt exist yet. There is one Resource
     * per path (not per request!).
     */

    var resourceFactory = function(rPath, rVars, rResourceName, rOptions, rData) {

      var pointer, data, resource;

      data = rData;

      if (data.type === TYPE_COLLECTION) {
        data.collectionArray = _.sort(_.unique(data.collectionArray));
      }

      pointer = new ResourcePointer(rPath, rVars, data).parseCacheKey(rOptions.cacheKey);

      if (! resourceCache.exists(pointer.cacheKey)) {

        // merge individual options with defaults

        var options = _.update(defaultOptions, rOptions);

        if (rData.type !== TYPE_ONE && ! _.isEmpty(rOptions.sideload)) {
          throw 'ResourceFactoryError: resources with array data cant handle sideloading';
        }

        if (! _.isEmpty(rOptions.sideload) && ! _.isEmpty(rOptions.nested)) {
          throw 'ResourceFactoryError: cant have a sideloading and nested option at the same time';
        }

        if (ALLOWED_RETRIEVAL_METHODS.indexOf(options.method) === -1) {
          throw 'ResourceServiceError: method is not allowed';
        }

        // create resource and put it in cache

        resource = new Resource(pointer, rResourceName, options);
        resourceCache.set(pointer.cacheKey, resource);

        // first fetch after creating when not in silent mode

        if (! options.silent) {
          resource.fetch();
        }

        // start $interval when given

        if (options.interval > 0) {
          intervalUtils.start(resource, options.interval);
        }

      } else {
        resource = resourceCache.get(pointer.cacheKey);
      }

      return resource;

    };

    /* @ resourceService
     *
     * exposes all available methods from the service
     */

    var resourceService = function(rPath, rVars) {

      var vars = rVars || {};

      function _isValid() {

        if (! rPath) {
          throw 'ResourceServiceError: path is missing';
        }

        if (! angular.isObject(vars)) {
          throw 'ResourceServiceError: path vars parameter must be an object';
        }

      }

      function _delegate(rResourceName, rOptions, rData) {

        var options;

        _isValid();

        if (! (rResourceName && typeof rResourceName === 'string')) {
          throw 'ResourceServiceError: resource name is missing or is not a string';
        }

        options = rOptions || {};

        if (! angular.isObject(vars)) {
          throw 'ResourceServiceError: options parameter must be an object';
        }

        return resourceFactory(rPath, vars, rResourceName, options, rData);
      }

      function _manipulate(rOptions, rLocalUpdates) {
        var options = rOptions || {};

        _isValid();

        if (! angular.isObject(vars)) {
          throw 'ResourceServiceError: options parameter must be an object';
        }

        return resourceManipulator(rPath, vars, options, rLocalUpdates);
      }

      // public interface

      return {

        // basic watch methods (GET, HEAD)

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

        // change single resource (DELETE, POST and PUT) methods

        send: function(rOptions, rLocalUpdates) {
          return _manipulate(rOptions, rLocalUpdates);
        },

        // reset (all) caches

        reset: function(rKey, rIds) {
          if (rKey) {
            if (rIds) {
              var ids = rIds;
              if (! angular.isArray(rIds)) {
                ids = [ rIds ];
              }
              angular.forEach(ids, function(eId) {
                var pointer = new ResourcePointer().build(rKey, eId);
                pointer.parseCacheKey();
                atomicCache.reset(pointer.cacheKey);
              });
              return true;
            }
            atomicCache.reset(rKey);
            resourceCache.reset(rKey);
          } else {
            atomicCache.resetAll();
            resourceCache.resetAll();
          }
          return true;
        },

        // debug methods

        debug: function() {
          return __debug;
        }

      };

    };

    return resourceService;

  }]);

})(window, window.angular);
