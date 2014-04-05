angular-watch-resource
======================

Model Layer for large angular 1.3 applications based on $watch pattern inspired by Jason Dobry's [Presentation](http://pseudobry.com/building-large-apps-with-angularjs.html).

## Features

* **single source of truth** inside a Resource service, returning all model data which gets then consumed by our view controllers and directives. With this approach all consumers get parallely informed when the model changes.

  ```
  $scope.$watch(function() {
    return Resource('/users/:id', { id: 22 }).one('users');
  }, function(user) {
    $scope.user = user;
  });
  ```

* **intelligent caching** with atomic resource handling to avoid making unnecessary requests (atomic resources are objects with an id and resource name like user id 5, user id 12, user id 42 etc). Especially in mobile apps you want to avoid expensive and energy-consuming network traffic.

  ```
  // we request an array of user resources (all)
  // example: user id 22 follows user id 501, 91 and 721

  $scope.$watch(function() {
    return Resource('/users/:id/followings', { id: 22 }).all('users');
  }, function(followings) {
    $scope.followings = followings;
  });

  // this request doesnt need to ask the server and we get the data immediately!

  Resource('/users/:id', { id: 501 }).one('users');
  ```

* **optimized requests**. As above we are looking to make efficient server requests. In collections the service avoids asking for resource which are already given

  ```
  Resource('/users/12').one('users');
  Resource('/users/13').one('users');
  Resource('/users/20').one('users');

  // somewhere later we ask for a collection ...

  Resource('/users').collection('users', [ 11, 12, 13, 12, 20, 182 ] );

  // .. and this is how the request looks like:

  /users?id[]=11&id[]=182
  ```

* **local data manipulations**. Sometimes we already want to change the model to response fast to the user input before we even informed the server. The server update is being handled in the background.

  ```
  Resource('/group/:id/follow', { id: 7 }).save({ method: 'POST' }, {
    name: 'group',
    id: 7,
    manipulate: function(group) {
      group.followed_user_ids.push(myUserId);
    }
  });
  ```

* **view states** to represent the status (isReady, isError, isEmpty) of our request with visual feedback in the view.

  ```
  <div ng-switch="user.isReady()">
    <div ng-switch-when="true">
      <p><strong>{{ user.data.username }}</strong></p>
      <p ng-show="user.data.online">is online!</p>
    </div>
    <div ng-switch-when="false">
      <p>Loading data..</p>
    </div>
  </div>
  ```

* **sideloading** to fill the resource cache with multiple data of different kind with only one request.

  ```
  Resource('/continents').one('continents', {
    sideload: {
      'users': 'users',
      'all_cities': 'cities',
      'countries': 'countries'
    }
  });
  ```

* **frequent interval updates** for keeping some data up-to-date by synchronizing with the server frequently

  ```
  var MINUTE = 60000;
  // update the user object every five minutes
  Resource('/user/me').one('users', { interval: 5 * MINUTE });
  ```

## Installation

(Requirements: This model layer service was built for an specific API which follows a strict stateless REST architecture.)

Add this line to your bower.json dependencies

    "angular-swipe":  "https://github.com/marmorkuchen-net/angular-watch-resource.git"

and run *bower install* afterwards.

Include this (or the minified) file in your main *.html* document:

    <script src="<your bower_components>/angular-watch-resource/dist/angular-watch-resource.js"></script>

and set *ngWatchResource* as a module dependency in your angular app. Inject *Resource* in all controllers or whereever you want to work with it.

You want to separate your different Resources by wrapping them in individual services. For example like this:

```
// user.js
angular.module('app').factory('User', [ 'Resource', function(Resource) {

  var User = {
    one: function(userId) {
      return Resource('/users/:id', { id: userId }).one('users');
    },
    followers: function(userId) {
      return Resource('/users/:id/followers', { id: userId }).all('users');
    },
    collection: function(userIds) {
      return Resource('/users').collection('users', userIds);
    }
  };

  return User;

}]);
```

## Configuration

Use the *ResourceConfigurationProvider* to set up the Resource service before runtime, for example like:

```
app.config(function(ResourceConfigurationProvider) {
  ResourceConfigurationProvider.setBasePath('https://api.yourserver.com/');
  ResourceConfigurationProvider.setDefaultParams({ 'app_id': '120321321' });
});
```

* setBasePath(*basePathUrlString*) this is the path to your api server. You can use a slash or not at the end of the string.
* setDefaultData(*defaultDataObject*) use an object to pass over default data in each http request
* setDefaultParams(*defaultParamsObject*) use an object to pass over default parameters in each http request
* setDefaultHeaders(*defaultHeadersObject*) use an object to pass over default headers in each http request

## Documentation

The Resource service exposes the methodes *one*, *all*, *collection*, *send*, *reset* and *debug*. In most of the cases only the first four are needed.

| Resource Service    | Resource Type              | Allowed HTTP methods     |
| ------------------- |----------------------------| -------------------------|
| one                 | object (single resource)   | GET*, HEAD               |
| all                 | array                      | GET*, HEAD               |
| collection          | array                      | GET*, HEAD               |
| send                | (object)                   | POST*, PUT, DELETE       |

\*) default HTTP method when none given

### Resource

A resource is basically a pointer to your data. Every unique path ("/users/212", "/group/111/followers" etc.) is a pointer. In the background the service handles the state of your data, is collecting it from the cache and looks for optimized server requests (to avoid loading data twice).

#### Path, Path Variables and Pointers

The syntax to create a Resource is:

    Resource(resourcePath [,resourceVars])

This resource is pointing now to the given resourcePath. The resourceVars are optional and basically helpers to replace variables in your resourcePath which begin with a colon (:name). For example:

    // points to the resource /books/917/pages/7
    Resource('/books/:id/pages/:pageId', { id: 917, pageId: 7 })

You can easily make these vars more dynamic so you are pointing to different data when they are changing:

    $scope.$watch(function() {
      return Resource('/users/:id', { id: $scope.selectedUserId }).one('users');
    }, function(user) {
      $scope.selectedUser = user;
    });

#### The Resource Object

In nearly all of the cases the service returns a *Resource* object which exposes the following properties:

##### Meta Information ("read-only")

These meta-properties are being ignored by angulars digest process:

* $createdTimestamp (*Number*) - unix timestamp with the time when the resource was initalized and ready for a server request
* $updatedTimestamp (*Number*) - unix timestamp with the time of the last successful request and data update from the server
* $resourceName (*String*) - the given resource name (like "users" or "books")
* $url (*String*) - the parsed url string we are using for the server request

##### Data ("read-only")

* data (*Object* or *Array*) - depending on the request (one, all or collection) this is a single object or an array of multiple objects containing the data we got from the server

##### Functions

* **fetch**([successCallback, errorCallback, disableOptimization, disableCaching]) (returns *Resource*)

  Example:

  ```
  Resource('/users/51').one('users').fetch(function(userResource) {
    // some more traditional approach here..
    $scope.user = userResource;
  });
  ```

  Arguments:

  - successCallback(resource) (*Function*) [optional]
  - errorCallback(resource) (*Function*) [optional]
  - disableOptimization (*Boolean*) [optional]
  - disableCaching (*Boolean*) [optional]

* **isEmpty**() (returns *Boolean*)
* **isReady**() (returns *Boolean*)
* **isError**() (returns *Boolean*)

The Booleans indicate the state of the Resource. When the resource is...

|            | initalized | fetched    | error      |
| ---------- | ---------- | ---------- | ---------- |
| isEmpty    | false      | true/false | true/false |
| isReady    | false      | true       | false      |
| isError    | false      | false      | true       |

* **message**([allMessages]) (returns *Object* or *Array*)

  returns the latest error message, *undefined* when none given.

  Arguments:

  - allMessages (*Boolean*) [optional]
  if this is set *true* the method will return all error messages of this resource, as an array, sorted by date

* **start**(updateFrequency) (returns *Boolean*)

  creates an $interval job, calling a resource fetch in a frequent interval, read further under Resource Options for more info about update intervals.

  If this is called multiple times on the same Resource it will replace the old interval job when the frequency has changed (returns true, otherwise false).

  Arguments:

  - updateFrequency (*Number*)
  the update frequency in milliseconds

* **stop**() (returns *Boolean*)

  cancels the given $interval job (returns true). Returns false when none was given.

### Resource.one()

@TODO

### Resource.all()

@TODO

### Resource.collection()

@TODO

### Resource.send()

@TODO

### Resource Options

Default Options:

    interval: 0
    silent: false
    sideload: {}
    withCredentials: false
    responseType: 'json'
    method: 'GET'
    data: {}
    params: {}
    headers: {}

@TODO

## Debugging

@TODO

## Development

This code is part of an large app and written for an individual case but please feel free to send pull and feature requests to make it more generic!

Fetch respository and set up environment

    git clone git@github.com:marmorkuchen-net/angular-watch-resource.git
    npm install && bower install

Start a server on localhost:9000 which is checking your js syntax and running the tests in background after every save. You can also open a browser and check the examples here.

    grunt serve

To build the source (in dist folder) just run

    grunt
