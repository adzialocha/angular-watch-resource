/*! angular-watch-resource.js 28-03-2014 */
(function(window, angular, undefined) {
  "use strict";
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
      hash = (hash << 5) - hash + hStr.charCodeAt(i);
      hash = hash & hash;
    }
    return hash.toString();
  }
  function _serialize(sParams) {
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
  }
  var ngWatchResource = angular.module("angular-watch-resource", []);
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
  ngWatchResource.factory("Resource", [ "$cacheFactory", "$http", "ResourceConfiguration", function($cacheFactory, $http, ResourceConfiguration) {
    var _cache = $cacheFactory("resourceCache");
    function Path(rUrl, rValues) {
      this.url = rUrl;
      this.values = rValues;
    }
    Path.prototype.build = function() {
      var _this, url;
      if (!this.values) {
        return this.url;
      }
      _this = this;
      url = this.url.replace(/\\:/g, ":");
      angular.forEach(Object.keys(this.values), function(eKey) {
        url = url.replace(new RegExp(":" + eKey, "g"), _this.values[eKey]);
      });
      return url;
    };
    function Resource(rCacheId, rIsArray) {
      this._cacheId = rCacheId;
      this._createdTimestamp = _now();
      this._updatedTimestamp = this._createdTimestamp;
      this._type = rIsArray ? "array" : "object";
      this.data = rIsArray ? [] : {};
      this.ready = false;
      this.error = null;
    }
    Resource.prototype = {
      setReady: function(sData, sReadyValue) {
        this.data = sData;
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
        if (this._type === "array" && this.ready) {
          return this.data.length === 0;
        } else if (this._type === "object" && this.ready) {
          return Object.keys(this.data).length === 0;
        } else {
          return false;
        }
      }
    };
    function watchResource(rPath, rVars, rOptions) {
      var options = {
        isArray: false,
        withCredentials: false,
        responseType: "json",
        method: "GET",
        data: ResourceConfiguration.defaultData,
        params: ResourceConfiguration.defaultParams,
        headers: ResourceConfiguration.defaultHeaders
      };
      if (rOptions && typeof rOptions === "object") {
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
      var path = new Path(rPath, rVars).build();
      var cacheKey = _hash(path);
      if (!_cache.get(cacheKey)) {
        var resource = new Resource(cacheKey, options.isArray);
        _cache.put(cacheKey, resource);
        var request = {
          method: options.method,
          url: ResourceConfiguration.basePath + path + _serialize(options.params),
          data: options.data,
          headers: options.headers,
          withCredentials: options.withCredentials,
          responseType: options.responseType,
          cache: false
        };
        $http(request).success(function(rData) {
          resource.setReady(rData);
          _cache.put(cacheKey, resource);
        }).error(function(rErrorData) {
          resource.setError(rErrorData);
        });
      }
      return _cache.get(cacheKey);
    }
    return watchResource;
  } ]);
})(window, window.angular);