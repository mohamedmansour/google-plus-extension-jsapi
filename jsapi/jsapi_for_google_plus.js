/**
 * Unofficial Google Plus API. It mainly supports user and circle management.
 *
 * Mohamed Mansour (http://mohamedmansour.com) *
 * @constructor
 */
GooglePlusAPI = function(opt) {
  //------------------------ Constants --------------------------
  // Implemented API
  this.CIRCLE_API              = 'https://plus.google.com/u/0/_/socialgraph/lookup/circles/?m=true';
  this.FOLLOWERS_API           = 'https://plus.google.com/u/0/_/socialgraph/lookup/followers/?m=1000000';
  this.FIND_PEOPLE_API         = 'https://plus.google.com/u/0/_/socialgraph/lookup/find_more_people/?m=10000';
  this.MODIFYMEMBER_MUTATE_API = 'https://plus.google.com/u/0/_/socialgraph/mutate/modifymemberships/';
  this.REMOVEMEMBER_MUTATE_API = 'https://plus.google.com/u/0/_/socialgraph/mutate/removemember/';
  this.CREATE_MUTATE_API       = 'https://plus.google.com/u/0/_/socialgraph/mutate/create/';
  this.PROPERTIES_MUTATE_API   = 'https://plus.google.com/u/0/_/socialgraph/mutate/properties/';
  this.DELETE_MUTATE_API       = 'https://plus.google.com/u/0/_/socialgraph/mutate/delete/';
  this.SORT_MUTATE_API         = 'https://plus.google.com/u/0/_/socialgraph/mutate/sortorder/';
  this.BLOCK_MUTATE_API        = 'https://plus.google.com/u/0/_/socialgraph/mutate/block_user/';
  this.INITIAL_DATA_API        = 'https://plus.google.com/u/0/_/initialdata?key=14';
  this.PROFILE_GET_API         = 'https://plus.google.com/u/0/_/profiles/get/';
  this.PROFILE_SAVE_API        = 'https://plus.google.com/u/0/_/profiles/save?_reqid=0';
  this.QUERY_API               = 'https://plus.google.com/u/0/_/s/';
  this.LOOKUP_API              = 'https://plus.google.com/u/0/_/socialgraph/lookup/hovercards/';
  this.ACTIVITY_API          = 'https://plus.google.com/u/0/_/stream/getactivity/';

  // Not Yet Implemented API
  this.CIRCLE_ACTIVITIES_API   = 'https://plus.google.com/u/0/_/stream/getactivities/'; // ?sp=[1,2,null,"7f2150328d791ede",null,null,null,"social.google.com",[]]
  this.SETTINGS_API            = 'https://plus.google.com/u/0/_/socialgraph/lookup/settings/';
  this.INCOMING_API            = 'https://plus.google.com/u/0/_/socialgraph/lookup/incoming/?o=[null,null,"116805285176805120365"]&n=1000000';
  this.SOCIAL_API              = 'https://plus.google.com/u/0/_/socialgraph/lookup/socialbar/';
  this.INVITES_API             = 'https://plus.google.com/u/0/_/socialgraph/get/num_invites_remaining/';
  this.PROFILE_PHOTOS_API      = 'https://plus.google.com/u/0/_/profiles/getprofilepagephotos/116805285176805120365';
  this.PLUS_API                = 'https://plus.google.com/u/0/_/plusone';
  this.COMMENT_API             = 'https://plus.google.com/u/0/_/stream/comment/';
  this.MEMBER_SUGGESTION_API   = 'https://plus.google.com/u/0/_/socialgraph/lookup/circle_member_suggestions/'; // s=[[[null, null, "116805285176805120365"]]]&at=

	//------------------------ Private Fields --------------------------
  this._opt = opt || {};
  this._db = this._opt.use_mockdb ? new MockDB() : new PlusDB();

  this._session = null;
  this._info = null;

  this.BURST_INTERVAL = 2000; // time between requesting 'more/burst' search results


  this._db.open();
};

//------------------------ Private Functions --------------------------
/**
 * Parse JSON string in a clean way by removing a bunch of commas and brackets. These should only
 * be used in Google post requests.
 *
 * @param {string} input The irregular JSON string to parse.
 */
GooglePlusAPI.prototype._parseJSON = function(input) {
  var jsonString = input.replace(/\[,/g, '[null,');
  jsonString = jsonString.replace(/,\]/g, ',null]');
  jsonString = jsonString.replace(/,,/g, ',null,');
  jsonString = jsonString.replace(/,,/g, ',null,');
  return JSON.parse(jsonString);
};

/**
 * Sends a request to Google+ through the extension. Does some parsing to fix
 * the data when retrieved.
 *
 * @param {function(Object.<string, Object>)} callback
 * @param {string} url The URL to request.
 * @param {string} postData If specified, it will do a POST with the data.
 */
GooglePlusAPI.prototype._requestService = function(callback, url, postData) {
  /*
  // This somehow doesn't work perhaps missing some headers :< Use jQuery to make this portion easier.
  var xhr = new XMLHttpRequest();
  xhr.open(postData ? 'POST' : 'GET', url, false);
  xhr.overrideMimeType('application/json; charset=UTF-8');
  xhr.send(postData || null);
  */
  var self = this;
  var success = function(data, textStatus, jqXHR) {
    if (data.status != 200) {
      callback({
        error: data.status,
        text: data.statusText
      });
    }
    else {
      var text = data.responseText;
      var uglyResults = data.responseText.substring(4);
      var results = self._parseJSON(uglyResults);
      callback(Array.isArray(results) ? results[0] : results);
    }
  };
  var xhr = $.ajax({
    type: postData ? 'POST' : 'GET',
    url: url,
    data: postData || null,
    dataType: 'json',
    async: true,
    complete: success
  });
};

/**
 * Parse out the post object since it is mangled data which majority of the
 * entries are not needed.
 *
 * @param {Object<Array>} element Google datastructure.
 * @return {Object} The parsed post.
 */
GooglePlusAPI.prototype._parsePost = function(element) {
  var item = {};
  item.type = element[2].toLowerCase();
  item.time = element[5];
  if (element[70]) {
    item.time_edited = parseInt((element[70] + '').substring(0, (item.time + '').length));
  }

  item.url = this._buildProfileURLFromItem(element[21]);
  item.is_public = (element[32] == '1');
  
  item.owner = {};
  item.owner.name = element[3];
  item.owner.id = element[16];
  item.owner.image = this._fixImage(element[18]);

  if (element[43]) { // Share?
    item.share = {};
    item.share.name = element[43][0];
    item.share.id = element[43][1];
    item.share.image = this._fixImage(element[43][4]);
    item.share.html = element[43][4];
    item.share.url = this._buildProfileURLFromItem(element[43][4]);
    item.html = element[47];
  }
  else { // Normal
    item.html = element[4];
  }

  // Parse hangout item.
  if (element[2] == 'Hangout') {
    var hangoutData = element[82][2][1][0];
    var hangoutURL = hangoutData[1];
    var hangoutID = hangoutData[0];
    var hangoutType = hangoutData[6];
    var isActive = (!hangoutURL || hangoutURL == '') ? false : true;
    if (isActive) {
      hangoutURL += '#_' + element[8];
    }
    // Skip this since it isn't a hangout. It is just youtube content.
    if (isActive && hangoutID == '' && hangoutType == 2 /*normal*/) {
        // Perhaps we want to deal with this later.
    }
    else {
      item.owner.status = true;
      item.data = {};
      item.data.url = hangoutURL;
      item.data.type = hangoutType;
      item.data.active = isActive;
      item.data.id = hangoutID;
      item.data.participants = [];
      item.data.extra_data = hangoutData[13];
      
      var cachedOnlineUsers = {};
      var onlineParticipants = hangoutData[3];
      for (var i in onlineParticipants) {
        var elt = onlineParticipants[i];
        var user = this._buildUserFromItem(elt[2], elt[0], elt[1], true);
        cachedOnlineUsers[user.id] = true;
        item.data.participants.push(user);
      }
      var offlineParticipants = hangoutData[4];
      for (var i in offlineParticipants) {
        var elt = offlineParticipants[i];
        var user = this._buildUserFromItem(elt[2], elt[0], elt[1], false);
        if (!cachedOnlineUsers[user.id]) {
          item.data.participants.push(user);
        }
      }
    }
  }
  
  return item;
};

/**
 * Parse out the user object since it is mangled data which majority of the
 * entries are not needed.
 *
 * @param {Object<Array>} element Google datastructure.
 * @param {boolean} extractCircles Extract circle information as well..
 * @return {Array[person, userCircles]} The parsed person.
 */
GooglePlusAPI.prototype._parseUser = function(element, extractCircles) {
  var email = element[0][0];
  var id = element[0][2];
  var name = element[2][0];
  var score = element[2][3];
  var photo = element[2][8];
  var location = element[2][11];
  var employment = element[2][13];
  var occupation = element[2][14];

  // Only store what we need, saves memory but takes a tiny bit more time.
  var user = {}
  if (id) user.id = id;
  if (email) user.email = email;
  if (name) user.name = name;
  if (score) user.score = score;
  if (photo) {
    if (photo.indexOf('http') != 0) {
      photo = 'https:' + photo;
    }
    user.photo = photo;
  }
  if (location) user.location = location;
  if (employment) user.employment = employment;
  if (occupation) user.occupation = occupation;

  // Circle information for the user wanted.
  var cleanCircles = [];
  if (extractCircles) {
    var dirtyCircles = element[3];
    dirtyCircles.forEach(function(element, index) {
      cleanCircles.push(element[2][0]);
    });
    return [user, cleanCircles];
  }
  else {
    return user;
  }
};

/**
 * Fire callback safely.
 *
 * @param {Function<Object>} callback The callback to fire back.
 * @param {Object} The data to send in the callback.
 */
GooglePlusAPI.prototype._fireCallback = function(callback, data) {
  if (callback) {
    callback(data);
  }
};

/**
 * Each Google+ user has their own unique session, fetch it and store
 * it. The only way getting that session is from their Google+ pages
 * since it is embedded within the page.
 *
 * @param {boolean} opt_reset If set, it will reset the internal cache.
 * @return {string} The Google+ user private session used for authentication.
 */
GooglePlusAPI.prototype._getSession = function(opt_reset) {
  if (opt_reset || !this._session) {
    var xhr = $.ajax({
      type: 'GET',
      url: 'https://plus.google.com',
      data: null,
      async: false
    });

    /*
    var match = xhr.responseText.match(/,"((?:[a-zA-Z0-9]+_?)+:[0-9]+)",/);
    if (match) {
      this._session = (match && match[1]) || null;
    }
    */
    // For some reason, the top command is becoming unstable in Chrome. It
    // freezes the entire browser. For now, we will just discover it since
    // indexOf doesn't freeze while search/match/exec freezes.
    var isLogged = false;
    var searchForString = ',"https://www.google.com/csi","';
    var responseText = xhr.responseText;
    if (responseText != null) {
      var startIndex = responseText.indexOf(searchForString);
      if (startIndex != -1) {
        var remainingText = responseText.substring(startIndex + searchForString.length);
        var foundSession = remainingText.substring(0, remainingText.indexOf('"'));
      
        // Validates it.
        if (foundSession.match(/((?:[a-zA-Z0-9]+_?)+:[0-9]+)/)) {
          this._session = foundSession;
          isLogged = true;
        }
      }
    }
    if (!isLogged) {
      // TODO: Somehow bring that back to the user.
      this._session = null;
      console.error('Invalid session, please login to Google+');
    }
  }
  return this._session;
};

/**
 * For each post in the stream, it builds the user object.
 *
 * @param {string} id The userid.
 * @param {string} name The name.
 * @param {string} image The image url.
 * @param {boolean} status The active status.
 * @return {Object} the user object.
 */
GooglePlusAPI.prototype._buildUserFromItem = function(id, name, image, status) {
  var ret = {};
  if (id) { ret.id = id; }
  if (name) { ret.name = name; }
  if (image) {
    // Some images don't have the protocols, so we fix that.
    if (image.indexOf('https') == -1) {
      image = 'https:' + image;
    }
    ret.image = image;
  }
  ret.status = status ? status : false;
  return ret;
};

/**
 * Build URL from the stream item.
 *
 * @param {string} url The profile url.
 */
GooglePlusAPI.prototype._buildProfileURLFromItem = function(url) {
  if (url.indexOf('https') == -1) {
    url = 'http://plus.google.com/' + url;
  }
  return url;
};

/**
 * Fix the image since some are corrupted with no https.
 */
GooglePlusAPI.prototype._fixImage = function(image) {
  if (image.indexOf('https') == -1) {
    image = 'https:' + image;
  }
  return image;
};

/**
 * Verify the session is valid if not, log it and fire the callback quickly.
 * 
 * Every caller must return if false.
 */
GooglePlusAPI.prototype._verifySession = function(name, args) {
  if (!this.isAuthenticated()) {
    var callback = args[0];
    var params = JSON.stringify(args); // this will remove the functions
    this._fireCallback(callback, { status: false, data: 'Session error. Name: [' + name + '] Arguments: [' + params + ']'});
    return false;
  }
  return true;
};

/**
 * Verifies the response if successfull.
 *
 * @param {Function<Object>} callback The callback to fire back.
 * @param {Object} The error data to send in the callback.
 */
GooglePlusAPI.prototype._isResponseSuccess = function(callback, response) {
  if (response.error) {
    this._fireCallback(callback, { status: false, data: response.error + ' - ' + response.text });
    return false;
  }
  else {
    return true;
  }
};

//----------------------- Public Functions ------------------------.
/**
 * @return True if session is valid to Google+.
 */
GooglePlusAPI.prototype.isAuthenticated = function() {
  return this._session != null;
};

/**
 * @return Get the pointer to the native database entities.
 */
GooglePlusAPI.prototype.getDatabase = function() {
  return this._db;
};

/**
 * Does the first prefetch.
 */
GooglePlusAPI.prototype.init = function(callback) {
  this._getSession(true); // Always reset the cache if called.
  this._fireCallback(callback, this.isAuthenticated());
};

/**
 * Invalidate the circles and people in my circles cache and rebuild it.
 *
 * @param {boolean} opt_onlyCircles Optional parameter to just persist circle
 */
GooglePlusAPI.prototype.refreshCircles = function(callback, opt_onlyCircles) {
  if (!this._verifySession('refreshCircles', arguments)) {
    return;
  }
  
  var self = this;
  var onlyCircles = opt_onlyCircles || false;
  this._requestService(function(response) {
    var dirtyCircles = response[1];
    self._db.getCircleEntity().clear(function(res) {
      if (!res.status) {
        self._fireCallback(callback, false);
      }
      else {
        var dirtyUsers = response[2];

        var circleEntity = self._db.getCircleEntity();
        var personEntity = self._db.getPersonEntity();
        var personCircleEntity = self._db.getPersonCircleEntity();

        // Batch variable.s
        var batchRemaining = [dirtyCircles.length, dirtyUsers.length, 0];
        var batchInserts = [[], [], []];
        var batchCounter = [0, 0, 0];
        var batchEntity = [circleEntity, personEntity, personCircleEntity];
        var batchNames = ['CircleEntity', 'PeopleEntity', 'PersonCircleEntity'];

        // Counter till we are done.
        var remaining = onlyCircles ? batchRemaining[0] : batchRemaining[0] + batchRemaining[1];
        var onComplete = function(result) {
          if (--remaining == 0) {
            self._fireCallback(callback, true);
          }
        };

        var onRecord = function(type, data) {
          batchCounter[type]++;
          batchInserts[type].push(data);
          if (batchCounter[type] % 1000 == 0 || batchCounter[type] == batchRemaining[type]) {
            batchEntity[type].create(batchInserts[type], onComplete);
            batchInserts[type] = [];
          }
        };

        // Persist Circles.
        dirtyCircles.forEach(function(element, index) {
          var id = element[0][0];
          var name = element[1][0];
          var description = element[1][2];
          var position = element[1][12];
          onRecord(0, {
            id: id,
            name: name,
            position: position,
            description: description
          });
        });

        // Skip since we require only circle.
        if (!onlyCircles) {
          // Persist People in your circles. Count number of total circles as well.
          dirtyUsers.forEach(function(element, index) {
            var userTuple = self._parseUser(element, true);
            var user = userTuple[0];
            user.in_my_circle = 'Y';
            var userCircles = userTuple[1];
            remaining += userCircles.length;
            batchRemaining[2] += userCircles.length;
            onRecord(1, user);
          });

          // For each person, persist them in their circles.
          dirtyUsers.forEach(function(element, index) {
            var userTuple = self._parseUser(element, true);
            var user = userTuple[0];
            var userCircles = userTuple[1];
            userCircles.forEach(function(element, index) {
              onRecord(2, {
                circle_id: element,
                person_id: user.id
              });
            });
          });
        }
      }
    });
  }, this.CIRCLE_API);
};

/**
 * Invalidate the people who added me cache and rebuild it.
 */
GooglePlusAPI.prototype.refreshFollowers = function(callback) {
  if (!this._verifySession('refreshFollowers', arguments)) {
    return;
  }
  var self = this;
  this._requestService(function(response) {
    var dirtyFollowers = response[2];

    // Counter till we are done.
    var remaining = dirtyFollowers.length;
    var onComplete = function(result) {
      if (--remaining == 0) {
        self._fireCallback(callback, true);
      }
    };

    var batchInserts = [], batchCounter = 0;
    var onRecord = function(entity, user) {
      batchCounter++;
      batchInserts.push(user);
      if (batchCounter % 1000 == 0 || batchCounter == remaining) {
        entity.create(batchInserts, onComplete);
        batchInserts = [];
      }
    };

    var personEntity = self._db.getPersonEntity();
    dirtyFollowers.forEach(function(element, index) {
      var user = self._parseUser(element);
      user.added_me = 'Y';
      onRecord(personEntity, user);
    });
  }, this.FOLLOWERS_API);
};

/**
 * Invalidate the people to discover cache and rebuild it.
 */
GooglePlusAPI.prototype.refreshFindPeople = function(callback) {
  if (!this._verifySession('refreshFindPeople', arguments)) {
    return;
  }
  var self = this;
  this._requestService(function(response) {
    var dirtyUsers = response[1];

    // Counter till we are done.
    var remaining = dirtyUsers.length;
    var onComplete = function(result) {
      if (--remaining == 0) {
        self._fireCallback(callback, true);
      }
    };

    var batchInserts = [], batchCounter = 0;
    var onRecord = function(entity, user) {
      batchCounter++;
      batchInserts.push(user);
      if (batchCounter % 1000 == 0 || batchCounter == remaining) {
        entity.create(batchInserts, onComplete);
        batchInserts = [];
      }
    };

    var personEntity = self._db.getPersonEntity();
    dirtyUsers.forEach(function(element, index) {
      var user = self._parseUser(element[0]);
      onRecord(personEntity, user);
    });
  }, this.FIND_PEOPLE_API);
};

/**
 * Gets the initial data from the user to recognize their ACL to be used in other requests.
 * especially in the profile requests.
 *
 * You can get more stuff from this such as:
 *   - circles (not ordered)
 *   - identities (facebook, twitter, linkedin, etc)
 *
 * @param {function(boolean)} callback
 */
GooglePlusAPI.prototype.refreshInfo = function(callback) {
  if (!this._verifySession('refreshInfo', arguments)) {
    return;
  }
  var self = this;
  this._requestService(function(response) {
    var responseMap = self._parseJSON(response[1]);
    self._info = {};
    // Just get the fist result of the Map.
    for (var i in responseMap) {
      var detail = responseMap[i];
      var emailParse = detail[20].match(/(.+) <(.+)>/);
      self._info.full_email = emailParse[0];
      self._info.name = emailParse[1];
      self._info.email = emailParse[2];
      self._info.id = detail[0];
      self._info.acl = '"' + (detail[1][14][0][0]).replace(/"/g, '\\"') + '"';
      self._info.circles = detail[10][1].map(function(element) {
        return {id: element[0], name: element[1]}
      });
      break;
    }
    self._fireCallback(callback, {
      status: true,
      data: self._info
    });
  }, this.INITIAL_DATA_API);
};

/**
 * Add people to a circle in your account.
 *
 * @param {function(string)} callback The ids of the people added.
 * @param {string} circle the Circle to add the people to.
 * @param {{Array.<string>}} users The people to add.
 */
GooglePlusAPI.prototype.addPeople = function(callback, circle, users) {
  if (!this._verifySession('addPeople', arguments)) {
    return;
  }
  var self = this;
  var usersArray = [];
  users.forEach(function(element, index) {
    usersArray.push('[[null,null,"' + element + '"],null,[]]');
  });
  var data = 'a=[[["' + circle + '"]]]&m=[[' + usersArray.join(',') + ']]&at=' + this._getSession();
  this._requestService(function(response) {
    var dirtyPeople = response[2];

    // Counter till we are done.
    var remaining = dirtyPeople.length;
    var onComplete = function(result) {
      if (--remaining == 0) {
        self._fireCallback(callback, true);
      }
    };
    dirtyPeople.forEach(function(element, index) {
      var user = self._parseUser(element);
      user.in_my_circle = 'Y';
      self._db.getPersonEntity().create(user, function(result) {
        self._db.getPersonCircleEntity().create({
          circle_id: circle,
          person_id: user.id
        }, onComplete)
      });
    });
  }, this.MODIFYMEMBER_MUTATE_API, data);
};

/**
 * Remove people from a circle in your account.
 *
 * @param {function(string)} callback
 * @param {string} circle the Circle to remove people from.
 * @param {{Array.<string>}} users The people to add.
 */
GooglePlusAPI.prototype.removePeople = function(callback, circle, users) {
  if (!this._verifySession('removePeople', arguments)) {
    return;
  }
  var self = this;
  var usersArray = [];
  users.forEach(function(element, index) {
    usersArray.push('[null,null,"' + element + '"]');
  });
  var data = 'c=["' + circle + '"]&m=[[' + usersArray.join(',') + ']]&at=' + this._getSession();
  this._requestService(function(response) {
    // Counter till we are done.
    var remaining = users.length;
    var onComplete = function(result) {
      if (--remaining == 0) {
        self._fireCallback(callback, true);
      }
    };
    users.forEach(function(element, index) {
      self._db.getPersonEntity().remove(element, onComplete);
    });
  }, this.REMOVEMEMBER_MUTATE_API, data);
};

/**
 * Create a new empty circle in your account.
 *
 * @param {function(string)} callback The ID of the circle.
 * @param {string} name The circle names.
 * @param {string} opt_description Optional description.
 */
GooglePlusAPI.prototype.createCircle = function(callback, name, opt_description) {
  if (!this._verifySession('createCircle', arguments)) {
    return;
  }
  var self = this;
  var data = 't=2&n=' + encodeURIComponent(name) + '&m=[[]]';
  if (opt_description) {
    data += '&d=' + encodeURIComponent(opt_description);
  }
  data += '&at=' + this._getSession();
  this._requestService(function(response) {
    var id = response[1][0];
    var position = response[2];
    self._db.getCircleEntity().persist({
      id: id,
      name: name,
      position: position,
      description: opt_description
    }, callback);
  }, this.CREATE_MUTATE_API, data);
};

/**
 * Removes a circle from your profile.
 *
 * @param {function(boolean)} callback.
 * @param {string} id The circle ID.
 */
GooglePlusAPI.prototype.removeCircle = function(callback, id) {
  if (!this._verifySession('removeCircle', arguments)) {
    return;
  }
  var self = this;
  var data = 'c=["' + id + '"]&at=' + this._getSession();
  this._requestService(function(response) {
    self._db.getCircleEntity().remove(id, callback);
  }, this.DELETE_MUTATE_API, data);
};

/**
 * Modify a circle circle given their ID.
 *
 * @param {function(boolean)} callback
 * @param {string} id The circle ID.
 * @param {string} opt_name Optional name
 * @param {string} opt_description Optional description.
 */
GooglePlusAPI.prototype.modifyCircle = function(callback, id, opt_name, opt_description) {
  if (!this._verifySession('modifyCircle', arguments)) {
    return;
  }
  var self = this;
  var requestParams = '?c=["' + id + '"]';
  if (opt_name) {
    requestParams += '&n=' + encodeURIComponent(opt_name);
  }
  if (opt_description) {
    requestParams += '&d=' + encodeURIComponent(opt_description);
  }
  var data = 'at=' + this._getSession();
  this._requestService(function(response) {
    self._db.getCircleEntity().update({
      id: id,
      name: opt_name,
      description: opt_description
    }, callback);
  }, this.PROPERTIES_MUTATE_API + requestParams, data);
};

/**
 * Sorts the circle based on some index.
 * TODO: We need to refresh the circles entity since positions will be changed.
 * @param {function(boolean)} callback
 * @param {string} id The circle ID
 * @param {number} index The index to move that circle to. Must be > 0.
 */
GooglePlusAPI.prototype.sortCircle = function(callback, circle_id, index) {
  if (!this._verifySession('sortCircle', arguments)) {
    return;
  }
  var self = this;
  index = index > 0 || 0;
  var requestParams = '?c=["' + circle_id + '"]&i=' + parseInt(index);
  var data = 'at=' + this._getSession();
  this._requestService(function(response) {
    self._fireCallback(callback, true);
  }, this.SORT_MUTATE_API + requestParams, data);
};

/**
 * Blocks or unblocks users from your account.
 * @param {function(boolean)} callback
 * @param {{Array.<string>}} users The people to add.
 * @param {boolean} opt_block Should the users be blocked or unblocked (defaults to block).
 */
GooglePlusAPI.prototype.modifyBlocked = function(callback, users, opt_block) {
  if (!this._verifySession('modifyBlocked', arguments)) {
    return;
  }
  var self = this;
  var usersArray = users.map(function(element) {
    return '[[null,null,"' + element + '"]]';
  });
  var toBlock = 'true';
  if (opt_block == false) {
    toBlock = 'false';
  }
  var data = 'm=[[' + usersArray.join(',') + '],' + toBlock + ']&at=' + this._getSession();
  this._requestService(function(response) {
    self._fireCallback(callback, (!response.error));
  }, this.BLOCK_MUTATE_API, data);
};

/**
 * Gets access to the entire profile for a specific user.
 *
 * @param {function(boolean)} callback
 * @param {string} id The profile ID
 */
GooglePlusAPI.prototype.getProfile = function(callback, id) {
  if (!this._verifySession('getProfile', arguments)) {
    return;
  }
  var self = this;
  if (isNaN(id)) {
    return {};
  }
  this._requestService(function(response) {
    var obj = {
      introduction: response[1][2][14][1]
    };
    self._fireCallback(callback, obj);
  }, this.PROFILE_GET_API + id);
};

/**
 * Lookups the information, user and circle data for a specific
 * user. The circle data is basically just the circle ID.
 *
 * @param {function(boolean)} callback
 * @param {Array<string>} id The profile ID
 */
GooglePlusAPI.prototype.lookupUsers = function(callback, ids) {
  if (!this._verifySession('lookupUsers', arguments)) {
    return;
  }
  var self = this;
  var allParams = [];
  if (!Array.isArray(ids)) {
    ids = [ids];
  }
  ids.forEach(function(element, i) {
     allParams.push('[null,null,"' + element + '"]');
  });
  
  // We are just limited to the number of requests. In this case, we will create
  // 40 items in each bucket slice. Then keep doing requests until we finish our
  // buckets. It is like filling a tub of water with a cup, we keep pooring water
  // in the cup until we finished filling the tub up.
  var users = {};
  var MAX_SLICE = 40;
  var indexSliced = 0;
  
  // Internal request.
  var doRequest = function() {
    var usersParam = allParams.slice(indexSliced, indexSliced + MAX_SLICE);
    if (usersParam.length == 0) {
      self._fireCallback(callback, users);
      return;
    }
    indexSliced += usersParam.length;

    var params = '?n=6&m=[[' + usersParam.join(', ') + ']]';
    var data = 'at=' + self._getSession();
    self._requestService(function(response) {
      var usersArr = response[1];
      usersArr.forEach(function(element, i) {
        var userObj = self._parseUser(element[1], true);
        var user = userObj[0];
        var circles = userObj[1];
        users[user.id] = {
          data: user,
          circles: circles
        };
      });
      doRequest();
    }, self.LOOKUP_API + params, data);
  };
  doRequest();
};

/**
 * Queries the postID for the specific user.
 
 * @param {function(boolean)} callback
 * @param {string} userID The profile ID
 * @param {string} postID The post ID
 */
GooglePlusAPI.prototype.lookupPost = function(callback, userID, postID) {
  var self = this;
  if (!userID || !postID) {
    this._fireCallback(callback, {
      status: false,
      data: 'You must specifify a userID and postID parameters.'
    });
    return;
  }
  var params = userID + '?updateId=' + postID;
  this._requestService(function(response) {
    if (!self._isResponseSuccess(callback, response)) {
      return;
    }

    var item = self._parsePost(response[1]);
    self._fireCallback(callback, { status: true, data: item });
  }, this.ACTIVITY_API + params);
};

/**
 * Saves the profile information back to the current logged in user.
 *
 * TODO: complete this for the entire profile. This will just persist the introduction portion
 *       not everything else. It is pretty neat how Google is doing this side. kudos.
 *
 * @param {function(boolean)} callback      
 * @param {string} introduction The content.
 */
GooglePlusAPI.prototype.saveProfile = function(callback, introduction) {
  if (!this._verifySession('saveProfile', arguments)) {
    return;
  }
  var self = this;
  if (introduction) {
    introduction = introduction.replace(/"/g, '\\"');
  }
  else {
    introduction = 'null';
  }

  var acl = this.getInfo().acl;
  var data = 'profile=' + encodeURIComponent('[null,null,null,null,null,null,null,null,null,null,null,null,null,null,[[' +
      acl + ',null,null,null,[],1],"' + introduction + '"]]') + '&at=' + this._getSession();

  this._requestService(function(response) {
    self._fireCallback(callback, response.error ? true : false);
  }, this.PROFILE_SAVE_API, data);
};

// Search Type ENUM
GooglePlusAPI.SearchType = {};
GooglePlusAPI.SearchType.EVERYTHING = 1;
GooglePlusAPI.SearchType.PEOPLE_PAGES = 2;
GooglePlusAPI.SearchType.POSTS = 3;
GooglePlusAPI.SearchType.SPARKS = 4;
GooglePlusAPI.SearchType.HANGOUTS = 5;

// Search Privacy ENUM
GooglePlusAPI.SearchPrivacy = {};
GooglePlusAPI.SearchPrivacy.EVERYONE = 1;
GooglePlusAPI.SearchPrivacy.CIRCLES = 2;
GooglePlusAPI.SearchPrivacy.YOU = 5;

// Search Category ENUM
GooglePlusAPI.SearchCategory = {};
GooglePlusAPI.SearchCategory.BEST = 1;
GooglePlusAPI.SearchCategory.RECENT = 2;

/**
 * Searches Google+ for everything.
 *
 * @param {function(Object)} callback The response callback.
 * @param {string} query The textual query to search on.
 * @param {Object} opt_extra Optional extra params:
 *                           category : GooglePlusAPI.SearchCategory | default RECENT
 *                           privacy  : GooglePlusAPI.SearchPrivacy | default EVERYONE
 *                           type     : GooglePlusAPI.SearchType | default EVERYTHING
 *                           precache : | 1+
 *                           burst    : false
 *                           burst_size    : 8
 */
GooglePlusAPI.prototype.search = function(callback, query, opt_extra) {
  if (!this._verifySession('search', arguments)) {
    return;
  }
  var self = this;
  var extra = opt_extra || {};
  var category = extra.category || GooglePlusAPI.SearchCategory.RECENT;
  var type = extra.type || GooglePlusAPI.SearchType.EVERYTHING;
  var privacy = extra.privacy || GooglePlusAPI.SearchPrivacy.EVERYONE;
  var precache = extra.precache || 1;
  var burst = extra.burst || false;
  var burst_size = extra.burst_size || 8;
  var mode = 'query';
  query = query.replace(/"/g, '\\"'); // Escape only quotes for now.
  
  var data = 'srchrp=[["' + query + '",' + type + ',' + category + ',[' + privacy +']' +
             ']$SESSION_ID]&at=' + this._getSession();
  var processedData = data.replace('$SESSION_ID', '');
  
  var doRequest = function(searchResults) {
    self._requestService(function(response) {
      var errorExists = !response[1] || !response[1][1];
      if (errorExists) {
        self._fireCallback(callback, {
          status: false,
          data: searchResults
        });
      } else {
        var streamID = response[1][1][2]; // Not Used.
        var trends = response[1][3]; // Not Used.
        var dirtySearchResults = response[1][1][0][0];
        processedData = data.replace('$SESSION_ID', ',null,["' + streamID + '"]');
        for (var i = 0; i < dirtySearchResults.length; i++) {
          var item = self._parsePost(dirtySearchResults[i]);
          searchResults.push(item);
        };
        
        // Page the results.
        if (precache > 1) {
          precache--;
          doRequest(searchResults); // Recurse till we are done paging.
        }
        else {
          self._fireCallback(callback, {
            status: true,
            data: searchResults,
            mode: mode
          });
          // Decide whether to do bursts or not.
          if (burst && 
               (mode === 'rt' || searchResults.length>0)){  // Bursts cannot start if there are initially no results
            mode = 'rt';
            if (--burst_size > 0) {
                setTimeout(function() {
                doRequest([]);
              }.bind(this), self.BURST_INTERVAL);
            }
          }
        }
      }
    }, self.QUERY_API + mode, processedData);
  };
  
  var searchResults = [];
  doRequest(searchResults); // Initiate.
};

/**
 * @return {Object.<string, string>} The information from the user.
 *                                    - id | name | email | acl
 */
GooglePlusAPI.prototype.getInfo = function() {
  return this._info;
};

/**
 * @param {function(Object)} callback All the circles.
 */
GooglePlusAPI.prototype.getCircles = function(callback) {
  this._db.getCircleEntity().find([], {}, callback);
};

/**
 * @param {number} id The circle ID to query.
 * @param {function(Object)} callback All the circles.
 */
GooglePlusAPI.prototype.getCircle = function(id, callback) {
  this._db.getCircleEntity().find([], {id: id}, callback);
};

/**
 * @param {Object} obj The search object.
 * @param {function(Object)} callback All the circles.
 */
GooglePlusAPI.prototype.getPeople = function(obj, callback) {
  this._db.getPersonEntity().find([], obj, callback);
};

/**
 * @param {number} id The person ID.
 * @param {function(Object)} callback The person involved.
 */
GooglePlusAPI.prototype.getPerson = function(id, callback) {
  this._db.getPersonEntity().find([], {id: id}, callback);
};

/**
 * @param {function(Object)} callback People in my circles.
 */
GooglePlusAPI.prototype.getPeopleInMyCircles = function(callback) {
  this._db.getPersonEntity().find([], {in_my_circle: 'Y'}, callback);
};

/**
 * @param {number id The person ID.
 * @param {function(Object)} callback The person in my circle.
 */
GooglePlusAPI.prototype.getPersonInMyCircle = function(id, callback) {
  this._db.getPersonEntity().find([], {in_my_circle: 'Y', id: id}, callback);
};

/**
 * @param {function(Object)} callback The people who added me.
 */
GooglePlusAPI.prototype.getPeopleWhoAddedMe = function(callback) {
  this._db.getPersonEntity().find([], {added_me: 'Y'}, callback);
};

/**
 * @param {number} id The person ID.
 * @param {function(Object)} callback The person who added me.
 */
GooglePlusAPI.prototype.getPersonWhoAddedMe = function(id, callback) {
  this._db.getPersonEntity().find([], {added_me: 'Y', id: id}, callback);
};
