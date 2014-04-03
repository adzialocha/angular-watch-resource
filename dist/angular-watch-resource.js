/*! angular-watch-resource.js v0.0.1 04-04-2014 */
(function(window, angular, undefined) {
  "use strict";
  var ngWatchResource = angular.module("ngWatchResource", []);
  ngWatchResource.provider("ResourceConfiguration", [ function() {
    var _configuration = {
      basePath: "",
      defaultData: {},
      defaultParams: {},
      defaultHeaders: {}
    };
    var ResourceConfiguration = {
      setBasePath: function(bPath) {
        if (bPath && typeof bPath === "string") {
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
      $get: function() {
        return {
          basePath: _configuration.basePath,
          defaultData: _configuration.defaultData,
          defaultParams: _configuration.defaultParams,
          defaultHeaders: _configuration.defaultHeaders
        };
      }
    };
    return ResourceConfiguration;
  } ]);
  ngWatchResource.factory("Resource", [ "$cacheFactory", "$http", "$q", "$interval", "ResourceConfiguration", function($cacheFactory, $http, $q, $interval, ResourceConfiguration) {
    var ID_KEY = "id";
    var FORCED_ID_START = 1;
    var DEFAULT_METHOD = "GET";
    var DEFAULT_COLLECTION_KEY = "id";
    var DEFAULT_ARRAY = [];
    var DEFAULT_OBJECT = {};
    var TYPE_ALL = 0;
    var TYPE_ONE = 1;
    var TYPE_COLLECTION = 2;
    var STATUS_INITALIZED = 10;
    var STATUS_LOADING = 20;
    var STATUS_FETCHED = 30;
    var STATUS_ERROR = 40;
    var defaultOptions = {
      interval: 0,
      silent: false,
      sideload: {},
      withCredentials: false,
      responseType: "json",
      data: angular.copy(ResourceConfiguration.defaultData),
      params: angular.copy(ResourceConfiguration.defaultParams),
      headers: angular.copy(ResourceConfiguration.defaultHeaders)
    };
    var _forcedId = FORCED_ID_START;
    var _intervalJobs = {};
    var __debug = {};
    var _ = {};
    _.unique = function(cArray) {
      return cArray.filter(function(value, index, self) {
        return self.indexOf(value) === index;
      });
    };
    _.hash = function(hString) {
      var hash, i, len;
      hash = 0;
      len = hString.length;
      if (len === 0) {
        return hash;
      }
      for (i = 0; i < len; i++) {
        hash = (hash << 5) - hash + hString.charCodeAt(i);
        hash = hash & hash;
      }
      return hash.toString();
    };
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
    _.now = function() {
      var date = new Date();
      return date.getTime();
    };
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
    _.pluck = function(eCollection, eIdentifier) {
      var values = [];
      angular.forEach(eCollection, function(eItem) {
        if (eIdentifier in eItem) {
          values.push(eItem[eIdentifier]);
        }
      });
      return values;
    };
    _.serialize = function(sParams) {
      var paramArray, serialized;
      paramArray = [];
      serialized = "";
      angular.forEach(Object.keys(sParams), function(pKey) {
        if (sParams.hasOwnProperty(pKey)) {
          if (angular.isArray(sParams[pKey])) {
            angular.forEach(sParams[pKey], function(eArrayItem) {
              paramArray.push(encodeURIComponent(pKey) + "[]=" + eArrayItem);
            });
          } else {
            paramArray.push(encodeURIComponent(pKey) + "=" + encodeURIComponent(sParams[pKey]));
          }
        }
      });
      if (paramArray.length > 0) {
        serialized = "?" + paramArray.join("&");
      }
      return serialized;
    };
    var IntervalUtils = {};
    IntervalUtils.start = function(rResource, rFrequency) {
      var _this = this;
      var id = rResource.$__meta.pointer.cacheKey;
      var createNew = false;
      if (!angular.isNumber(rFrequency)) {
        throw "IntervalUtils: interval frequency must be a number";
      }
      if (!(id in _intervalJobs)) {
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
            _this.stop(rResource);
          }, true);
        }, rFrequency);
        __debug.__intervals = _intervalJobs;
      }
      return createNew;
    };
    IntervalUtils.stop = function(rResource) {
      var id = rResource.$__meta.pointer.cacheKey;
      if (!(id in _intervalJobs)) {
        return false;
      }
      $interval.cancel(_intervalJobs[id].promise);
      delete _intervalJobs[id];
      __debug.__intervals = _intervalJobs;
      return true;
    };
    var Cache = function(cName) {
      __debug[cName] = {};
      this.name = cName;
      this.storage = $cacheFactory(cName);
    };
    Cache.prototype = {
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
      update: function(pCacheKey, pCacheData) {
        var data = this.get(pCacheKey);
        data.$updatedTimestamp = _.now();
        data.data = pCacheData;
        return this.storage.put(pCacheKey, data);
      }
    };
    var resourceCache = new Cache("__resourceCache");
    var atomicCache = new Cache("__atomicCache");
    var CacheUtils = {};
    CacheUtils.Resource = {
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
    CacheUtils.Atomic = {
      _insertData: function(cResourceName, cObject) {
        if (!(ID_KEY in cObject)) {
          cObject[ID_KEY] = "__internal" + _forcedId;
          _forcedId++;
        }
        var pointer = new ResourcePointer().build(cResourceName, cObject[ID_KEY]);
        pointer.parseCacheKey();
        if (!atomicCache.exists(pointer.cacheKey)) {
          var atomic = new AtomicResource(cResourceName, cObject[ID_KEY]);
          atomicCache.set(pointer.cacheKey, atomic);
        }
        atomicCache.update(pointer.cacheKey, cObject);
        return pointer.cacheKey;
      },
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
      cacheKeyArray: function(cDataArray, cResourceName) {
        var cacheKeys = [];
        angular.forEach(cDataArray, function(dItem) {
          var pointer = new ResourcePointer().build(cResourceName, dItem);
          cacheKeys.push(pointer.parseCacheKey());
        });
        return cacheKeys;
      },
      findUncached: function(cDataArray, cResourceName) {
        return cDataArray.filter(function(eIdItem) {
          var pointer = new ResourcePointer().build(cResourceName, eIdItem);
          pointer.parseCacheKey();
          return !atomicCache.exists(pointer.cacheKey);
        });
      },
      populateCache: function(cOptions, cResourceName, cObject) {
        var _this = this;
        var atomicCacheKeys = [];
        if (angular.isArray(cObject)) {
          angular.forEach(cObject, function(eItem) {
            atomicCacheKeys.push(_this._insertData(cResourceName, eItem));
          });
        } else {
          atomicCacheKeys.push(this._insertData(cResourceName, cObject));
          if (!_.isEmpty(cOptions.sideload)) {
            this._insertSideloadData(cOptions.sideload, cObject);
          }
        }
        return atomicCacheKeys;
      }
    };
    var AtomicResource = function(rResourceName, rId) {
      this.$createdTimestamp = _.now();
      this.$updatedTimestamp = this.$createdTimestamp;
      this.$resourceName = rResourceName;
      this.$resourceId = rId;
      this.data = DEFAULT_OBJECT;
    };
    var ResourcePointer = function(rPath, rVars, rData) {
      this._path = rPath || "";
      this._vars = rVars || {};
      this._data = rData || {
        type: TYPE_ONE
      };
      this.cacheKey = undefined;
      this.resourcePath = "";
    };
    ResourcePointer.prototype.isCollection = function() {
      return this._data.type === TYPE_COLLECTION;
    };
    ResourcePointer.prototype.build = function(rResourceName, rId) {
      this._path = rResourceName + "/:id";
      this._vars[ID_KEY] = rId;
      return this;
    };
    ResourcePointer.prototype.parseCacheKey = function() {
      var path, keys, i, len;
      path = this._path;
      path = path.replace(/\\:/g, ":");
      if (this._vars) {
        keys = Object.keys(this._vars);
        len = keys.length;
        for (i = 0; i < len; i++) {
          path = path.replace(new RegExp(":" + keys[i], "g"), this._vars[keys[i]]);
        }
      }
      if (path[0] !== "/") {
        path = "/" + path;
      }
      this.resourcePath = path;
      if (this.isCollection()) {
        var hashed = _.hash(this._data.collectionArray.join("."));
        path = path + "?" + this._data.collectionKey + "=" + hashed;
      }
      this.cacheKey = path;
      return this;
    };
    ResourcePointer.prototype.serializeUrl = function(sParams, sOptimizedCollectionArray) {
      var params, serialized;
      params = sParams;
      if (this.isCollection()) {
        var collection = {};
        if (this._data.collectionKey in sParams) {
          throw "ResourcePointerError: collection key already exists as parameter";
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
      if (basePath[basePath.length - 1] === "/") {
        basePath = basePath.slice(0, basePath.length - 1);
      }
      return basePath + this.resourcePath + serialized;
    };
    var RequestUtils = {};
    RequestUtils.build = function(rPointer, rOptions) {
      var url = rPointer.serializeUrl(rOptions.params);
      var request = {
        method: DEFAULT_METHOD,
        url: url,
        data: rOptions.data,
        headers: rOptions.headers,
        withCredentials: rOptions.withCredentials,
        responseType: rOptions.responseType,
        cache: false
      };
      return request;
    };
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
    var Resource = function(rPointer, rResourceName, rOptions) {
      this.$__meta = {
        pointer: rPointer,
        options: rOptions,
        errors: [],
        status: STATUS_INITALIZED
      };
      this.$createdTimestamp = _.now();
      this.$updatedTimestamp = this.$createdTimestamp;
      this.$requestTimestamp = undefined;
      this.$resourceName = rResourceName;
      this.$url = rPointer.serializeUrl(rOptions.params);
      this.data = rPointer._data.type === TYPE_ONE ? DEFAULT_OBJECT : DEFAULT_ARRAY;
    };
    Resource.prototype = {
      fetch: function(fSuccess, fError, fDisableOptimization) {
        var _this = this;
        var pointer, options, atomicCacheKeys, request;
        pointer = this.$__meta.pointer;
        options = this.$__meta.options;
        request = RequestUtils.build(pointer, options);
        if (!fDisableOptimization) {
          var optimized = RequestUtils.optimize(request, pointer, options, this.$resourceName);
          atomicCacheKeys = optimized.cachedAtomicKeys;
          CacheUtils.Resource.buildData(pointer, atomicCacheKeys);
          if (optimized.requestNotNeeded) {
            this.$__meta.status = STATUS_FETCHED;
            if (fSuccess && angular.isFunction(fSuccess)) {
              fSuccess(this);
            }
            return this;
          } else {
            request = optimized.request;
          }
        }
        if (!this.isReady()) {
          this.$__meta.status = STATUS_LOADING;
        }
        $http(request).then(function(fResult) {
          atomicCacheKeys = CacheUtils.Atomic.populateCache(options, _this.$resourceName, fResult.data);
          CacheUtils.Resource.buildData(pointer, atomicCacheKeys);
          _this.$requestTimestamp = _.now();
          _this.$__meta.status = STATUS_FETCHED;
          if (fSuccess && angular.isFunction(fSuccess)) {
            fSuccess(_this);
          }
        }, function(fErrorData) {
          _this.$__meta.status = STATUS_ERROR;
          _this.$__meta.errors.push(fErrorData.data);
          if (fError && angular.isFunction(fError)) {
            fError(_this);
          }
        });
        return this;
      },
      start: function(sIntervalFrequency) {
        return IntervalUtils.start(this, sIntervalFrequency);
      },
      stop: function() {
        return IntervalUtils.stop(this);
      },
      isError: function() {
        return this.$__meta.status === STATUS_ERROR;
      },
      isReady: function() {
        return this.$__meta.status === STATUS_FETCHED;
      },
      isEmpty: function() {
        return this.$__meta.status === STATUS_FETCHED && _.isEmpty(this.data);
      },
      message: function(mReturnAll) {
        var errors = this.$__meta.errors;
        if (errors.length === 0) {
          return undefined;
        } else {
          if (!mReturnAll) {
            return errors[errors.length - 1];
          } else {
            return errors;
          }
        }
      }
    };
    var ResourceFactory = function(rPath, rVars, rResourceName, rOptions, rData) {
      var pointer, data, resource;
      data = rData;
      if (data.type === TYPE_COLLECTION) {
        data.collectionArray = _.unique(data.collectionArray).sort();
      }
      pointer = new ResourcePointer(rPath, rVars, data).parseCacheKey();
      if (!resourceCache.exists(pointer.cacheKey)) {
        var options = _.update(defaultOptions, rOptions);
        if (rData.type !== TYPE_ONE && !_.isEmpty(rOptions.sideload)) {
          throw "ResourceFactoryError: resources with array data cant handle sideloading";
        }
        resource = new Resource(pointer, rResourceName, options);
        resourceCache.set(pointer.cacheKey, resource);
        if (!options.silent) {
          resource.fetch(false);
        }
        if (options.interval > 0) {
          IntervalUtils.start(resource, options.interval);
        }
      } else {
        resource = resourceCache.get(pointer.cacheKey);
      }
      return resource;
    };
    var ResourceService = function(rPath, rVars) {
      var vars = rVars || {};
      function _delegate(rResourceName, rOptions, rData) {
        var options;
        if (!rPath) {
          throw "ResourceServiceError: path is missing";
        }
        if (!angular.isObject(vars)) {
          throw "ResourceServiceError: path vars parameter must be an object";
        }
        if (!(rResourceName && typeof rResourceName === "string")) {
          throw "ResourceServiceError: resource name is missing or is not a string";
        }
        options = rOptions || {};
        if (!angular.isObject(vars)) {
          throw "ResourceServiceError: options parameter must be an object";
        }
        return ResourceFactory(rPath, vars, rResourceName, options, rData);
      }
      return {
        all: function(rResourceName, rOptions) {
          return _delegate(rResourceName, rOptions, {
            type: TYPE_ALL
          });
        },
        one: function(rResourceName, rOptions) {
          return _delegate(rResourceName, rOptions, {
            type: TYPE_ONE
          });
        },
        collection: function(rResourceName, rCollection, rCollectionKey, rOptions) {
          var key;
          if (!(rCollection && angular.isArray(rCollection))) {
            throw "ResourceServiceError: collection parameter must be an array and not undefined";
          }
          key = rCollectionKey || DEFAULT_COLLECTION_KEY;
          return _delegate(rResourceName, rOptions, {
            type: TYPE_COLLECTION,
            collectionKey: key,
            collectionArray: rCollection
          });
        },
        manipulate: function() {
          return false;
        },
        debug: function() {
          return __debug;
        }
      };
    };
    return ResourceService;
  } ]);
})(window, window.angular);