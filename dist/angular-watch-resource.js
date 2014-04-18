/*! angular-watch-resource.js v0.5.1 18-04-2014 */
(function(window, angular, undefined) {
  "use strict";
  var ngWatchResource = angular.module("resource.service", []);
  ngWatchResource.provider("ResourceConfiguration", [ function() {
    var _configuration = {
      basePath: "",
      defaultData: {},
      defaultParams: {},
      defaultHeaders: {}
    };
    var resourceConfiguration = {
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
    return resourceConfiguration;
  } ]);
  ngWatchResource.factory("Resource", [ "$cacheFactory", "$http", "$q", "$interval", "ResourceConfiguration", function($cacheFactory, $http, $q, $interval, ResourceConfiguration) {
    var ID_KEY = "id";
    var FORCED_ID_START = 1;
    var ALLOWED_RETRIEVAL_METHODS = [ "GET", "HEAD" ];
    var ALLOWED_MANIPULATION_METHODS = [ "PUT", "POST", "DELETE" ];
    var DEFAULT_MANIPULATION_METHOD = "POST";
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
      nested: {},
      withCredentials: false,
      responseType: "json",
      method: "GET",
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
    _.sort = function(cArray) {
      return cArray.sort(function(aItem, bItem) {
        return aItem - bItem;
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
    var intervalUtils = {};
    intervalUtils.start = function(rResource, rFrequency) {
      var _this = this;
      var id = rResource.$__meta.pointer.cacheKey;
      var createNew = false;
      if (!angular.isNumber(rFrequency)) {
        throw "intervalUtils: interval frequency must be a number";
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
    intervalUtils.stop = function(rResource) {
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
      update: function(pCacheKey, pCacheData, pUpdateIsLocal) {
        if (!this.exists(pCacheKey)) {
          return null;
        }
        var item = this.get(pCacheKey);
        if (!pUpdateIsLocal) {
          item.$updatedTimestamp = _.now();
        }
        item.data = pCacheData;
        return this.storage.put(pCacheKey, item);
      },
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
    var resourceCache = new Cache("__resourceCache");
    var atomicCache = new Cache("__atomicCache");
    var cacheUtils = {};
    cacheUtils.resource = {
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
    cacheUtils.atomic = {
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
          pointer.parseCacheKey();
          cacheKeys.push(pointer.cacheKey);
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
    ResourcePointer.prototype.buildCollection = function(rResourceName, rIds) {
      this._path = rResourceName;
      this._data = {
        type: TYPE_COLLECTION,
        collectionArray: rIds,
        collectionKey: DEFAULT_COLLECTION_KEY
      };
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
    var requestUtils = {};
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
      fetch: function(fSuccess, fError, fDisableOptimization, fDisableCaching) {
        function handleRequest(rRequestData, rOptions, rPointer, resourceName) {
          var deferred;
          deferred = $q.defer();
          var request, optimized, pointer, options, atomicCacheKeys;
          request = rRequestData;
          options = rOptions;
          pointer = rPointer;
          if (!fDisableOptimization) {
            optimized = requestUtils.optimize(request, pointer, options, resourceName);
            atomicCacheKeys = optimized.cachedAtomicKeys;
            if (!fDisableCaching) {
              cacheUtils.resource.buildData(pointer, atomicCacheKeys);
            }
            if (optimized.requestNotNeeded) {
              deferred.resolve(false);
              return deferred.promise;
            } else {
              request = optimized.request;
            }
          }
          $http(request).then(function(fResult) {
            if (!fDisableCaching) {
              atomicCacheKeys = cacheUtils.atomic.populateCache(options, resourceName, fResult.data);
              cacheUtils.resource.buildData(pointer, atomicCacheKeys);
            }
            deferred.resolve(true);
          }, function(fErrorData) {
            deferred.reject(fErrorData);
          });
          return deferred.promise;
        }
        function errorCallback(rResourceInstance, rErrorData) {
          rResourceInstance.$__meta.status = STATUS_ERROR;
          rResourceInstance.$__meta.errors.push(rErrorData.data);
          if (fError && angular.isFunction(fError)) {
            fError(rResourceInstance);
          }
        }
        function finalizeRequest(rPromises, rResourceInstance) {
          $q.all(rPromises).then(function(rHttpRequestNeeded) {
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
        var pointer, options;
        pointer = this.$__meta.pointer;
        options = this.$__meta.options;
        if (!this.isReady()) {
          this.$__meta.status = STATUS_LOADING;
        }
        var mainRequest, promises;
        mainRequest = requestUtils.build(pointer, options);
        promises = [];
        promises.push(handleRequest(mainRequest, options, pointer, this.$resourceName));
        if (_.isEmpty(options.nested)) {
          finalizeRequest(promises, this);
        } else {
          var _this = this;
          promises[0].then(function() {
            promises = [];
            var resourceNames = Object.keys(options.nested);
            var resourceIds = {};
            angular.forEach(resourceNames, function(rName) {
              resourceIds[rName] = [];
            });
            var mainResource = [];
            if (!angular.isArray(_this.data)) {
              mainResource = [ _this.data ];
            } else {
              mainResource = _this.data;
            }
            angular.forEach(mainResource, function(rItem) {
              angular.forEach(resourceNames, function(eResourceName) {
                var key = options.nested[eResourceName];
                var ids = rItem[key];
                if (!angular.isArray(ids)) {
                  ids = [ ids ];
                }
                resourceIds[eResourceName] = resourceIds[eResourceName].concat(ids);
              });
            });
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
        return this;
      },
      start: function(sIntervalFrequency) {
        return intervalUtils.start(this, sIntervalFrequency);
      },
      stop: function() {
        return intervalUtils.stop(this);
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
    var resourceManipulator = function(rPath, rVars, rOptions, rLocalUpdates) {
      var deferred, pointer, resource, options, resourceName;
      deferred = $q.defer();
      options = rOptions;
      if (!("method" in options)) {
        options.method = DEFAULT_MANIPULATION_METHOD;
      }
      options = _.update(defaultOptions, options);
      if (ALLOWED_MANIPULATION_METHODS.indexOf(options.method) === -1) {
        throw "ResourceServiceError: method is not allowed";
      }
      if (!(!_.isEmpty(rLocalUpdates) && rLocalUpdates.name && rLocalUpdates.id && rLocalUpdates.manipulate)) {
        throw "ResourceServiceError: resource manipulation info is missing";
      }
      if (!angular.isFunction(rLocalUpdates.manipulate)) {
        throw "ResourceServiceError: manipulate property must be a function";
      }
      var atomic = new ResourcePointer();
      atomic.build(rLocalUpdates.name, rLocalUpdates.id);
      atomic.parseCacheKey();
      if (!_.isEmpty(rLocalUpdates) && atomicCache.exists(atomic.cacheKey)) {
        var data = atomicCache.get(atomic.cacheKey).data;
        resourceName = rLocalUpdates.name;
        rLocalUpdates.manipulate(data);
        atomicCache.update(atomic.cacheKey, data, true);
      }
      pointer = new ResourcePointer(rPath, rVars).parseCacheKey();
      pointer.cacheKey = atomic.cacheKey;
      resource = new Resource(pointer, resourceName || undefined, options);
      resource.fetch(function() {
        deferred.resolve(resource);
      }, function() {
        deferred.reject(resource);
      }, true, resourceName ? false : true);
      return deferred.promise;
    };
    var resourceFactory = function(rPath, rVars, rResourceName, rOptions, rData) {
      var pointer, data, resource;
      data = rData;
      if (data.type === TYPE_COLLECTION) {
        data.collectionArray = _.sort(_.unique(data.collectionArray));
      }
      pointer = new ResourcePointer(rPath, rVars, data).parseCacheKey();
      if (!resourceCache.exists(pointer.cacheKey)) {
        var options = _.update(defaultOptions, rOptions);
        if (rData.type !== TYPE_ONE && !_.isEmpty(rOptions.sideload)) {
          throw "ResourceFactoryError: resources with array data cant handle sideloading";
        }
        if (!_.isEmpty(rOptions.sideload) && !_.isEmpty(rOptions.nested)) {
          throw "ResourceFactoryError: cant have a sideloading and nested option at the same time";
        }
        if (ALLOWED_RETRIEVAL_METHODS.indexOf(options.method) === -1) {
          throw "ResourceServiceError: method is not allowed";
        }
        resource = new Resource(pointer, rResourceName, options);
        resourceCache.set(pointer.cacheKey, resource);
        if (!options.silent) {
          resource.fetch();
        }
        if (options.interval > 0) {
          intervalUtils.start(resource, options.interval);
        }
      } else {
        resource = resourceCache.get(pointer.cacheKey);
      }
      return resource;
    };
    var resourceService = function(rPath, rVars) {
      var vars = rVars || {};
      function _isValid() {
        if (!rPath) {
          throw "ResourceServiceError: path is missing";
        }
        if (!angular.isObject(vars)) {
          throw "ResourceServiceError: path vars parameter must be an object";
        }
      }
      function _delegate(rResourceName, rOptions, rData) {
        var options;
        _isValid();
        if (!(rResourceName && typeof rResourceName === "string")) {
          throw "ResourceServiceError: resource name is missing or is not a string";
        }
        options = rOptions || {};
        if (!angular.isObject(vars)) {
          throw "ResourceServiceError: options parameter must be an object";
        }
        return resourceFactory(rPath, vars, rResourceName, options, rData);
      }
      function _manipulate(rOptions, rLocalUpdates) {
        var options = rOptions || {};
        _isValid();
        if (!angular.isObject(vars)) {
          throw "ResourceServiceError: options parameter must be an object";
        }
        return resourceManipulator(rPath, vars, options, rLocalUpdates);
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
        send: function(rOptions, rLocalUpdates) {
          return _manipulate(rOptions, rLocalUpdates);
        },
        reset: function(rKey, rIds) {
          if (rKey) {
            if (rIds) {
              var ids = rIds;
              if (!angular.isArray(rIds)) {
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
        debug: function() {
          return __debug;
        }
      };
    };
    return resourceService;
  } ]);
})(window, window.angular);