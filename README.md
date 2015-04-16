angular-watch-resource
======================

Model Layer for large angular >v1.3 applications with some niceties - based on $watch pattern inspired by Jason Dobry's [Presentation](http://pseudobry.com/building-large-apps-with-angularjs.html).

## Features

* **single source of truth** inside a Resource service. Returns data which can be consumed by our view controllers and directives. With this approach all consumers get parallely informed when the model changes.

  ```
  $scope.$watch(function() {
    return Resource('/users/:id', { id: 22 }).one('users');
  }, function(user) {
    $scope.user = user;
  });
  ```

* **intelligent caching** with atomic resource handling to avoid making unnecessary requests. *Atomic resources* are objects with an id and resource name like *user (id 5), user (id 12), user (id 42)* etc. Especially in mobile apps you want to avoid expensive and battery-consuming network traffic.

  ```
  // we request an array of user resources (all)
  // example: user id 22 follows user id 501, 91 and 721

  $scope.$watch(function() {
    return Resource('/users/:id/followings', { id: 22 }).all('users');
  }, function(followings) {
    $scope.followings = followings;
  });

  // this request doesnt need to ask the server, we get the data immediately!

  Resource('/users/:id', { id: 501 }).one('users');
  ```

* **optimized requests**. In collections and nested requests the service avoids asking for resources which are already given from past requests.

  ```
  Resource('/users/12').one('users');
  Resource('/users/13').one('users');
  Resource('/users/20').one('users');

  // somewhere later we ask for a collection ...

  Resource('/users').collection('users', [ 11, 12, 13, 12, 20, 182 ] );

  // .. and this is how the real http request looks like:

  /users?id[]=11&id[]=182
  ```

* **local data manipulations**. Sometimes we already want to change the model to respond fast to the user input. This happens before we even informed the server. The server update is handled in the background.

  ```
  Resource('/group/:id/follow', { id: 7 }).save({ method: 'POST' }, {
    name: 'group',
    id: 7,
    manipulate: function(group) {
      group.followed_user_ids.push(myUserId);
    }
  });
  ```

* **view states** to represent the status (isReady, isError, isEmpty) in the view.

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

* **nested resource builder** preparing the data and
all its related resources to make it ready for further processing

  ```
  // this fetches the related user and venue resource from every element
  // in the returned events array

  $scope.$watch(function() {
    return Resource('/events').all('events', {
      nested: {
        'users': 'attending_user_ids',
        'venues': 'venue_id'
      }
    });
  }, function(rData) {
    $scope.list = rData;
  });

  $scope.getUser = function(userId) {
    return Resource('/users/:id', { id: userId }).one('users');
  };

  $scope.getVenue = function(venueId) {
    return Resource('/venues/:id', { id: venueId }).one('venues');
  };

  // somewhere in the view we can be sure all the needed data is ready to be processed

  <ul ng-if="list.isReady()">
    <li ng-repeat="item in list.data" ng-init="venue = getVenue(item.venue_id)">
      <h2>Event {{ item.title }}</h2>
      <p>Venue: {{ venue.title }}</p>
      <p>Attending users:</p>
      <p ng-repeat="userId in item.attending_user_ids" ng-init="user = getUser(userId)">
        {{ user.first_name }} {{ user.last_name }}
      </p>
    </li>
  </ul>

  ```

* **frequent interval updates** for keeping some data up-to-date by synchronizing with the server frequently.

  ```
  var MINUTE = 60000;
  // update the user object every five minutes
  Resource('/user/me').one('users', { interval: 5 * MINUTE });
  ```

## Installation

**Please note**: This model layer service was built for an specific API which follows a strict stateless REST architecture. Read carefully if it fits your needs or make a pull request!

- Run `bower install angular-watch-resource`.

- Include this (or the minified) file in your main *.html* document:

  ```
  <script src="<your bower_components>/angular-watch-resource/dist/angular-watch-resource.js"></script>
  ```

- Set `resource.service` as a module dependency in your angular app. Inject `Resource` in all controllers or whereever you want to work with it.

- You want to separate your different Resources by wrapping them in individual services. For example like this:

  ```
  // User.js

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

Use the *ResourceConfigurationProvider* to set up the Resource service before runtime:

* **setBasePath**(basePathUrlString) - this is the path to your api server (with or without slash at the end)
* **setDefaultData**(defaultDataObject) - default data in each http request
* **setDefaultParams**(defaultParamsObject) - default parameters in each http request
* **setDefaultHeaders**(defaultHeadersObject) - default headers in each http request

**Example:**

```
app.config(function(ResourceConfigurationProvider) {
  ResourceConfigurationProvider.setBasePath('https://api.yourserver.com/');
  ResourceConfigurationProvider.setDefaultParams({ 'app_id': '120321321' });
});
```

## Documentation

The Resource service exposes the methods *one*, *all*, *collection*, *send*, *reset* and *debug*. In most of the cases only the first four are needed.

| Resource Service    | Resource Type              | Allowed HTTP methods     |
| ------------------- | -------------------------- | ------------------------ |
| one                 | object (single resource)   | GET*, HEAD               |
| all                 | array                      | GET*, HEAD               |
| collection          | array                      | GET*, HEAD               |
| send                | (object)                   | POST*, PUT, DELETE       |

\*) default HTTP method when none given

### Resource

A resource is basically a pointer to your data. Every unique path (*"/users/212", "/group/111/followers"* etc.) is a pointer. In the background the service handles the state of your data, collects all needed pieces from the cache and looks for optimized server requests (to avoid fetching data twice).

#### Path, Path Variables and Pointers

The syntax to create a Resource is:

* **Resource**(resourcePath [,resourceVars])

  Arguments:

  - resourcePath (*String*)
  - resourceVars (*Object*) [optional]

  The resource is pointing to the given *resourcePath*. The *resourceVars* are optional and basically helpers to replace variables in your *resourcePath*, starting with a colon (like *:name*).

  **Example:**

  ```
  // points to the resource /books/917/pages/7
  Resource('/books/:id/pages/:pageId', { id: 917, pageId: 7 })
  ```

  You can easily make these vars more dynamic to point to different data when they are changing:

  ```
  $scope.$watch(function() {
    return Resource('/users/:id', { id: $scope.selectedUserId }).one('users');
  }, function(user) {
    $scope.selectedUser = user;
  });
  ```

#### The Resource Object

In nearly all of the cases the service returns an *Resource* object which exposes the following properties:

##### Meta Information

These $meta-properties are being ignored by angulars digest cycle:

* `$createdTimestamp` (*Number*) - timestamp when the resource was initalized and ready for a server request
* `$updatedTimestamp` (*Number*) - timestamp of the last data change
* `$requestTimestamp` (*Number* or *undefined*) - timestamp of the last successful server request. When this is *undefined* this data was already stripped from another request and there is no need to do a server request (yay!).
* `$resourceName` (*String*) - the given resource name (like *users* or *books*)
* `$url` (*String*) - the url we are using for the server request

##### Data

* data (*Object* or *Array*) - depending on the request (*one, all* or *collection*) this is an single object or an array of multiple objects containing the data we got from the server.

##### Functions

* **fetch**([successCallback, errorCallback, disableOptimization, disableCaching]) (returns *Resource*)

  Arguments:

  - successCallback(resource) (*Function*) [optional]
  - errorCallback(resource) (*Function*) [optional]

  - disableOptimization (*Boolean*) [optional]
  Use false to disable request optimization. In optimized requests we try to avoid
  fetching data from the server which is already in our cache. This could be useful to
  make a fresh update of frequently changing data (you also might want to look into the
  *interval* option).

  - disableCaching (*Boolean*) [optional]
  Use false to disable propagating the cache after a successful request.

  **Example:**

  ```
  Resource('/users/51').one('users').fetch(function(userResource) {
    // some more traditional approach here..
    $scope.user = userResource;
  });
  ```

* **isEmpty**() (returns *Boolean*)
* **isReady**() (returns *Boolean*)
* **isError**() (returns *Boolean*)

  The returned booleans indicate the status of the Resource. When the resource is...

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

  creates an $interval job, calling a resource fetch in an frequent interval, read further under *Resource Options* for more info about update intervals.

  If this is called multiple times on the same Resource, it will replace the old interval job given the frequency has changed (returns true when succesfully replaced, otherwise false).

  Arguments:

  - updateFrequency (*Number*)
  the update frequency in milliseconds

* **stop**() (returns *Boolean*)

  cancels the given $interval job (returns true). Returns false when none was given.

### Retrieval methods

All of these methods return a initial *Resource* instance we can watch in our controllers (read more about it above).

* **Resource**(resourcePath [,resourceVars]).**one**(resourceName [, resourceOptions])

  Retrieves a single object from the server via GET method (for example */groups/21*).

  Arguments:

  - resourceName (*String*)
  this variable is needed to make the cache handler understand with which data it is dealing with. The returned data from the server will be interpreted with this name (like *users* or *countries* etc).

  - resourceOptions (*Object*) [optional]
  see Resource Options for further details

  **Example:**

  ```
  $scope.$watch(function() {
    return Resource('/messages/:id', { id: $scope.selectedMessage }).one('messages');
  }, function(message) {
    $scope.message = message;
  });
  ```

* **Resource**(resourcePath [,resourceVars]).**all**(resourceName [, resourceOptions])

  Retrieves an array of single objects from the server via GET method (*/groups/21/followers*, */groups* etc.).

  Arguments:

  - resourceName (*String*)
  this variable is needed to make the cache handler understand with which data it is dealing with. Every single element of this array of data will be interpreted with this name (like *users* or *countries* etc.)

  - resourceOptions (*Object*) [optional]
  see Resource Options for further details

  **Example:**

  ```
  $scope.$watch(function() {
    return Resource('/messages/:id/recipients', { id: $scope.selectedMessage }).all('users');
  }, function(recipients) {
    $scope.recipients = recipients;
  });
  ```

* **Resource**(resourcePath [,resourceVars]).**collection**(resourceName, collectionIds, [collectionKey], [ resourceOptions])

  Retrieves an array of single objects with a request containing specific ids via GET method (like */groups?id[]=22&id[]21*)

  Arguments:

  - resourceName (*String*)
  this variable is needed to make the cache handler understand with which data it is dealing with. The returned array from the server will be interpreted as a collection of data with this name (like *users* or *countries* etc.)

  - collectionIds (*Array*)
  contains the identifiers of the resources we are requesting, in most of the cases id's

  - collectionKey (*String*) [optional]
  key for your given collection array. Default is "id"

  - resourceOptions (*Object*) [optional]
  see Resource Options for further details

  **Example:**

  ```
  // this looks like: /pages?id[]=1&id[]=2&id[]=3
  $scope.$watch(function() {
    return Resource('/pages').collection('pages', [ 1,2, 3 ]);
  }, function(pages) {
    $scope.navigation = pages;
  });

  // this looks like: /pages?slug[]=home&slug[]=about&slug[]=contact
  $scope.$watch(function() {
    return Resource('/pages').collection('pages', [ "home", "about", "contact" ], "slug" );
  }, function(pages) {
    $scope.navigation = pages;
  });
  ```

### Update and manipulation methods

Different from the retrieval methods the manipulation methods return a *promise* instead of a Resource instance - since we dont want to watch single server requests like these.

* **Resource**(resourcePath [,resourceVars]).**send**([resourceOptions], [localUpdate], resourceName)

  Sends a POST request to the given path (or DELETE, PUT when set in options) and optionally changes the data of the Resource before the server gets informed.

  Arguments:

  - resourceOptions (*Object*) [optional]
  see Resource Options for further details

  - localUpdate (*Object* or *Array*) [optional]
  you can pass over a localUpdate object which looks like this:

  ```
  {
    name: <*String*>,
    id: <*Number*>,
    manipulate: function(resourceInstanceData) {
      // manipulate your resource here
    }
  }
  ```

  When you send the request, the data of the Resource with the name and id (example: */users/221*) can be already changed via the *manipulate* function. This function takes your current resource data as an argument. Your changes will be applied to the cache and are directly accessible by all resource $watchers.

  Changing your local data like this is only possible when the resource already exists in your cache.

  - resourceName
  name of the requested resource (for caching)

  **Example:**

  ```
  Resource('/messages/:id/edit', { id: $scope.selectedMessage }).send(
    {
      method: 'POST',
      params: {
        subject: $scope.editor.subject,
        text: $scope.editor.text
      }
    },
    {
      name: 'messages', // this doesnt have to be the same resource were sending this request to
      id: $scope.selectedMessage,
      manipulate: function (messageData) {
        messageData.subject = $scope.editor.subject;
        messageData.text = $scope.editor.text;
      }
    }, 'messages' // this is the resource we are sending the POST to
  ).then(function() {
    alert('You succesfully updated your message');
  });

  // this watch (somewhere else in the app) will react directly to your changes

  $scope.$watch(function() {
    return Resource('/messages/:id', { id: $scope.selectedMessage }).one('messages');
  }, function(message) {
    $scope.message = message;
  });

  ```

### Other methods

* **Resource**().**reset**([resourcePointer or -name], [resourceId or Array of Ids])

  Clears the whole cache, a collection or a specific resource.

  **Example:**

  ```
  // clear single resource
  Resource().reset('/users/221'); // or..
  Resource().reset('users', 221);

  // clear collection of resources
  Resource().reset('users', [ 221, 222, 223, 224, 827 ] );

  // clear everything
  Resource().reset();

  ```

* **Resource**().**debug**()

  returns a object with the current cache contents and interval jobs

### Resource Options

Default Options:

```
{
  interval: 0,             // interval in ms for frequent resource update requests
  silent: false,           // true to enable silent mode, does not send a request on init

  dataKey: '',             // resource data is inside a key (example: "data")

  cacheKey: undefined,     // use a custom cache key

  sideload: {},            // read -> sideloading resources option (below)
  sideloadKey: '',         // sideload resources are collected in an own object (example: "included")
  nested: {},              // read -> nested resources option (below)

  withCredentials: false,  // request with credentials
  responseType: 'json',    // response type like 'json', 'text', 'blob' etc.
  method: 'GET',           // possible methods: GET, POST, HEADER, PUT

  data: {},                // data of this request
  params: {},              // parameters of this request
  headers: {}              // headers of this request
}
```
for send methods the default method is 'POST'.

#### Sideloading Resources Option

Resources can hold bundles of other resources (for example for initial requests). With
the *sideload* option you can populate your cache correctly after fetching sideload resources.

**Example:**

```
/* /continents returns the following JSON:

  {
    users: [{ id: 1 }, { id: 2 }, { id: 3 }],
    all_cities: [{ id: 12 }, { id: 13 }, { id: 14 }],
    countries: [{ id: 22 }, { id: 81 }, { id: 91 }]
  }
*/

Resource('/continents').one('continents', {
  sideload: {
    'users': 'users',
    'all_cities': 'cities',
    'countries': 'countries'
  }
});

// this resource exists without a new server request

Resource('/cities/:id', { id: 912 } ).one('cities');

```
#### Nested Resources Option

Sometimes your app requires additional info from other resources before it can process a single object or array with resource data.
This options is useful to fetch your main object and all related resources to it (read above for another example).

Your Resource pointer will only be ready when all these additional resources are
ready as well. This is very useful since you want your data to be ready to be
available for the controllers and the view.

The *nested* option takes an object with resource name properties and related key values.

**Example:**

```
/*

1) Data on server looks like this:

  continents: [
    { id: 1, country_ids: [ 12, 13 ], rivers: [ 82, 12 ] },
    { id: 2, country_ids: [ 17, 19, 20 ], rivers: [ 12 ] },
    { id: 3, country_ids: [ 8 ], rivers: [ 82, 16 ] }
  ]

  rivers: [
    { id: 12 },
    { id: 16 },
    { id: 82 }
  ]

  countries: [
    { id: 8 },
    { id: 12 },
    { id: 13 },
    { id: 17 },
    { id: 19 },
    { id: 20 }
  ]

2) we make a nested request with the client, this results in
the following requests (given that the cache is empty)

- GET /continents
- GET /rivers?id[]=12&id[]=16&id[]=82
- GET /countries?id[]=8&id[]=12&id[]=13&id[]=17&id[]=18&id[]=20

*/

Resource('/continents').one('continents', {
  nested: {
    'countries': 'country_ids',
    'rivers': 'rivers_ids'
  }
});

// 3) this resource exists without a new server request

Resource('/countries/:id', { id: 19 } ).one('countries');

```
## Development

This code is part of an large app and written for an individual case but please feel free to send pull and feature requests to make it more generic!

Fetch respository and set up environment

    git clone git@github.com:marmorkuchen-net/angular-watch-resource.git
    npm install && bower install

Start a server on localhost:9000 which is checking your js syntax and running the tests in background after every save. You can also open a browser and check the examples here.

    grunt serve

To build the source (in dist folder) just run

    grunt
