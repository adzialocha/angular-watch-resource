(function(window, angular, undefined) {

  'use strict';

  function _now() {
    var now = new Date();
    return now.getTime();
  }

  function _hash(hStr) {
    var hash, i, len;
    hash = 0;
    len = hStr.length;
    if (len === 0) {
      return hash;
    }
    for (i = 0; i < len; i++) {
      hash = ( ( hash << 5 ) - hash ) + hStr.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString();
  }

  function _serialize(sParams) {
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
  }

  function _unique(cArray) {
    return cArray.filter(function(value, index, self) {
      return self.indexOf(value) === index;
    });
  }

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


  /* @ Resource
   * holds all methods to handle and watch server resources */

  ngWatchResource.factory('Resource', [ '$cacheFactory', '$http', '$q', '$interval', 'ResourceConfiguration',
    function($cacheFactory, $http, $q, $interval, ResourceConfiguration) {

    var _cache = $cacheFactory('resourceCache');

    // cacheHandler methods

    var _cacheHandler = {

      optimizeCollection: function(hCacheInfo) {
        var optimized = {
          cached: [],
          remote: []
        };

        var cacheKey;

        angular.forEach(hCacheInfo.collection, function(cItem) {
          cacheKey = hCacheInfo.resourceName + '/' + cItem;
          if (_cache.get(cacheKey) && _cache.get(cacheKey).ready) {
            optimized.cached.push(_cache.get(cacheKey).data);
          } else {
            optimized.remote.push(cItem);
          }
        });

        return optimized;
      },

      populate: function(hCacheInfo, hResources) {

        var cacheKey, resource, path;

        angular.forEach(hResources, function(cItem) {
          if ('id' in cItem) {
            cacheKey = hCacheInfo.resourceName + '/' + cItem.id;
            path = new Path(cacheKey, null);
            resource = new Resource(cacheKey, {}, path.cache);
            resource.setReady(cItem);
            _cache.put(cacheKey, resource);
          }
        });

        return true;
      }

    };

    // path

    function Path(rUrl, rValues) {
      this.url = rUrl;
      this.values = rValues;
      this.cache = {
        key: null,
        collectionKey: null,
        collection: [],
        resourceName: undefined,
        resourceId: undefined
      };
    }

    Path.prototype.build = function() {
      var _this, url, cacheKeys, cacheCollectionKey;
      _this = this;

      // find collection key

      cacheCollectionKey = this.url.match(/\{([^\}]+)\}/);

      if (cacheCollectionKey) {
        this.cache.collectionKey = cacheCollectionKey[1].replace(':', '');

        if (! (this.cache.collectionKey in this.values && angular.isArray(this.values[this.cache.collectionKey]))) {
          throw 'ngWatchResource Error: collection key given but does not point to an array';
        }

        this.cache.collection = _unique(this.values[this.cache.collectionKey]);
      }

      // replace vars

      url = this.url.replace(/\\:/g, ':');
      url = url.replace(/\{([^\}]+)\}/, '');

      if (this.values) {
        angular.forEach(Object.keys(this.values), function(eKey) {
          url = url.replace(new RegExp(':' + eKey, 'g'), _this.values[eKey]);
        });
      }

      // search for cache keys

      cacheKeys = url.match(/\[([^\]]+)\]/g);

      if (cacheKeys && cacheKeys.length > 0) {
        this.cache.key = cacheKeys.join('/').replace(/[\[\]]/g, '');
        var split = this.cache.key.split('/');
        this.cache.resourceName = split[0];
        if (cacheKeys.length > 1) {
          this.cache.resourceId = parseInt(split[1], 10);
        }
      }

      if (! cacheKeys && this.cache.collectionKey) {
        throw 'ngWatchResource Error: collection key but no resouce name given';
      }

      // remove cache brackets

      url = url.replace(/[\[\]]/g, '');

      return url;
    };

    // resource

    function Resource(rCacheKey, rOptions, rCache) {
      var _this = this;

      this.__promise = $q.defer();
      this.__options = rOptions;
      this.__interval = null;
      this.__cache = rCache;

      this._createdTimestamp = _now();
      this._updatedTimestamp = this._createdTimestamp;
      this._type = rOptions.isArray ? 'array' : 'object';

      this.data = rOptions.isArray ? [] : {};
      this.ready = false;
      this.error = null;

      if (rOptions.interval !== 0) {
        this.__interval = $interval(function() {
          _this.fetch(true);
        }, rOptions.interval);
      }
    }

    Resource.prototype = {
      promise: function() {
        return this.__promise.promise;
      },
      stopInterval: function() {
        $interval.cancel(this.__interval);
        return true;
      },
      fetch: function(fDisableOptimization) {
        var _this = this, params, concatResult;

        this.__promise = $q.defer();
        params = this.__options.params;
        concatResult = false;

        // optimize request

        if (! fDisableOptimization) {

          // look for cached resources when we fetch a collection

          if (this.__cache.collectionKey && this.__cache.collection.length > 0) {
            var optimized = _cacheHandler.optimizeCollection(this.__cache);
            params = this.__options.params;
            params[this.__cache.collectionKey] = optimized.remote;
            this.data = optimized.cached;

            if (optimized.remote.length === 0) {
              this.__promise.resolve(this);
              return true;
            }

            concatResult = true;
          }
        }

        // setup

        var request = {
          method: this.__options.method,
          url: this.__options.url + _serialize(params),
          data: this.__options.data,
          headers: this.__options.headers,
          withCredentials: this.__options.withCredentials,
          responseType: this.__options.responseType,
          cache: false
        };

        // $http request

        $http(request).success(function(rData) {
          _this.setReady(rData, true, concatResult);
          _cache.put(_this.__cache.key, _this);
          _this._updatedTimestamp = _now();

          if (_this.__cache.resourceName && _this._type === 'array') {
            _cacheHandler.populate(_this.__cache, rData);
          }

          _this.__promise.resolve(_this);
        }).error(function(rErrorData) {
          _this.setError(rErrorData);
          _this.__promise.reject(_this);
        });

      },
      setReady: function(sData, sReadyValue, sConcat) {
        if (sConcat && angular.isArray(this.data)) {
          this.data = this.data.concat(sData);
        } else {
          this.data = sData;
        }

        this.error = null;
        this.ready = sReadyValue || true;
        return this.ready;
      },
      setError: function(sErrorData) {
        this.error = sErrorData;
        this.ready = false;
        return true;
      },
      set: function(sKey, sValue) {
        this._updatedTimestamp = _now();
        this.data[sKey] = sValue;
        return true;
      },
      get: function(sKey) {
        return this.data[sKey];
      },
      isEmpty: function() {
        if (this._type === 'array' && this.ready) {
          return this.data.length === 0;
        } else if (this._type === 'object' && this.ready) {
          return Object.keys(this.data).length === 0;
        } else {
          return false;
        }
      }
    };

    // public

    function watchResource(rPath, rVars, rOptions) {

      var options = {
        isArray: false,
        withCredentials: false,
        responseType: 'json',
        method: 'GET',
        interval: 0,
        data: angular.copy(ResourceConfiguration.defaultData),
        params: angular.copy(ResourceConfiguration.defaultParams),
        headers: angular.copy(ResourceConfiguration.defaultHeaders)
      };

      // merge given options with defaults

      if (rOptions && typeof rOptions === 'object') {
        angular.forEach(Object.keys(rOptions), function(oKey) {
          if (oKey in options && typeof options[oKey] === typeof rOptions[oKey]) {
            if (angular.isObject(options[oKey])) {
              options[oKey] = angular.extend(options[oKey], rOptions[oKey]);
            } else {
              options[oKey] = rOptions[oKey];
            }
          }
        });
      }

      // create resource and http request

      var cacheKey, url, resource;
      var path = new Path(rPath, rVars);

      url = ResourceConfiguration.basePath + path.build();

      if (path.cache.key) {
        if (path.cache.collectionKey) {
          var collection = path.cache.collection.sort();
          cacheKey = _hash(collection.join('.'));
          options.params[path.cache.collectionKey] = collection;
          options.isArray = true;
        } else {
          cacheKey = path.cache.key;
        }
      } else {
        cacheKey = _hash(url);
      }

      options.url = url;

      if (! _cache.get(cacheKey)) {
        resource = new Resource(cacheKey, options, path.cache);
        _cache.put(cacheKey, resource);
        resource.fetch();
      } else {
        resource = _cache.get(cacheKey);
      }

      return resource;

    }

    return watchResource;

  }]);

})(window, window.angular);
