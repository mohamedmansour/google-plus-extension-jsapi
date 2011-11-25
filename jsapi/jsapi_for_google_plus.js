/**
 * Unofficial Google Plus API. It mainly supports user and circle management.
 *
 * Mohamed Mansour (http://mohamedmansour.com) *
 * @constructor
 */
GooglePlusAPI = function() {
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

  this.INITIAL_DATA_API        = 'https://plus.google.com/u/0/_/initialdata?key=14';

  this.PROFILE_GET_API         = 'https://plus.google.com/u/0/_/profiles/get/';
  this.PROFILE_SAVE_API        = 'https://plus.google.com/u/0/_/profiles/save?_reqid=0';

  this.QUERY_API               = 'https://plus.google.com/u/0/_/s/query';
  
  // Not Yet Implemented API
  this.CIRCLE_ACTIVITIES_API   = 'https://plus.google.com/u/0/_/stream/getactivities/'; // ?sp=[1,2,null,"7f2150328d791ede",null,null,null,"social.google.com",[]]
  this.SETTINGS_API            = 'https://plus.google.com/u/0/_/socialgraph/lookup/settings/';
  this.INCOMING_API            = 'https://plus.google.com/u/0/_/socialgraph/lookup/incoming/?o=[null,null,"116805285176805120365"]&n=1000000';
  this.SOCIAL_API              = 'https://plus.google.com/u/0/_/socialgraph/lookup/socialbar/';
  this.INVITES_API             = 'https://plus.google.com/u/0/_/socialgraph/get/num_invites_remaining/';
  this.HOVERCARD_API           = 'https://plus.google.com/u/0/_/socialgraph/lookup/hovercard/'; // ?m=[null,null,"111048918866742956374"]
  this.SEARCH_API              = 'https://plus.google.com/complete/search?ds=es_profiles&client=es-sharebox&partnerid=es-profiles&q=test';
  this.PROFILE_PHOTOS_API      = 'https://plus.google.com/u/0/_/profiles/getprofilepagephotos/116805285176805120365';
  this.PLUS_API                = 'https://plus.google.com/u/0/_/plusone';
  this.COMMENT_API             = 'https://plus.google.com/u/0/_/stream/comment/';
  this.MEMBER_SUGGESTION_API   = 'https://plus.google.com/u/0/_/socialgraph/lookup/circle_member_suggestions/'; // s=[[[null, null, "116805285176805120365"]]]&at=

	//------------------------ Private Fields --------------------------
  this._db = new PlusDB();

  this._session = null;
  this._info = null;

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
      var results = data.responseText.substring(4);
      callback(self._parseJSON(results));
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
  }

  return [user, cleanCircles];
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
 * @return {string} The Google+ user private session used for authentication.
 */
GooglePlusAPI.prototype._getSession = function() {
  if (!this._session) {
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
    var searchForString = ',"https://www.google.com/csi","';
    var startIndex = xhr.responseText.indexOf(searchForString);
    var remainingText = xhr.responseText.substring(startIndex + searchForString.length);
    this._session = remainingText.substring(0, remainingText.indexOf('"'));
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

//----------------------- Public Functions ------------------------.

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
  this._getSession();
  this._fireCallback(callback, true);
};

/**
 * Invalidate the circles and people in my circles cache and rebuild it.
 *
 * @param {boolean} opt_onlyCircles Optional parameter to just persist circle
 */
GooglePlusAPI.prototype.refreshCircles = function(callback, opt_onlyCircles) {
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
            console.log('Persisting ' + batchNames[type], batchInserts[type].length);
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
        console.log('Persisting Followers', batchInserts.length);
        batchInserts = [];
      }
    };

    var personEntity = self._db.getPersonEntity();
    dirtyFollowers.forEach(function(element, index) {
      var userTuple = self._parseUser(element);
      var user = userTuple[0];
      user.added_me = 'Y';
      onRecord(personEntity, user);
    });
  }, this.FOLLOWERS_API);
};

/**
 * Invalidate the people to discover cache and rebuild it.
 */
GooglePlusAPI.prototype.refreshFindPeople = function(callback) {
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
        console.log('Persisting Find People', batchInserts.length);
        batchInserts = [];
      }
    };

    var personEntity =self._db.getPersonEntity();
    dirtyUsers.forEach(function(element, index) {
      var userTuple = self._parseUser(element[0]);
      var user = userTuple[0];
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
  var self = this;
  this._requestService(function(response) {
    var responseMap = self._parseJSON(response[1]);
    info = {};
    // Just get the fist result of the Map.
    for (var i in responseMap) {
      var detail = responseMap[i];
      var emailParse = detail[20].match(/(.+) <(.+)>/);
      info.full_email = emailParse[0];
      info.name = emailParse[1];
      info.email = emailParse[2];
      info.id = detail[0];
      info.acl = '"' + (detail[1][14][0][0]).replace(/"/g, '\\"') + '"';
      break;
    }
    self._fireCallback(callback, true);
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
      userTuple = self._parseUser(element);
      var user = userTuple[0];
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
  var self = this;
  index = index > 0 || 0;
  var requestParams = '?c=["' + circle_id + '"]&i=' + parseInt(index);
  var data = 'at=' + this._getSession();
  this._requestService(function(response) {
    self._fireCallback(callback, true);
  }, this.SORT_MUTATE_API + requestParams, data);
};

/**
 * Gets access to the entire profile for a specific user.
 *
 * @param {function(boolean)} callback
 * @param {string} id The profile ID
 */
GooglePlusAPI.prototype.getProfile = function(callback, id) {
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
 * Saves the profile information back to the current logged in user.
 *
 * TODO: complete this for the entire profile. This will just persist the introduction portion
 *       not everything else. It is pretty neat how Google is doing this side. kudos.
 *
 * @param {function(boolean)} callback
 * @param {string} introduction The content.
 */
GooglePlusAPI.prototype.saveProfile = function(callback, introduction) {
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

/**
 * Searches Google+ for everything.
 *
 * @param {function(Object)} callback The response callback.
 * @param {string} query The textual query to search on.
 * @param {Object} opt_extra Optional extra params:
 *                           category : 'best' | 'recent'
 *                           precache : | 1+
 */
GooglePlusAPI.prototype.search = function(callback, query, opt_extra) {
  var self = this;
  var extra = opt_extra || {};
  var category = extra.category == 'best' ? 1 : 2;
  var precache = extra.precache || 1;
  query = query.replace(/"/g, '\\"'); // Escape only quotes for now.
  
  var data = 'srchrp=[["' + query + '",1,' + category + ',[1]]$SESSION_ID]&at=' + this._getSession();
  var processedData = data.replace('$SESSION_ID', '');
  
  var doRequest = function(searchResults) {
    self._requestService(function(response) {
      var streamID = response[1][1][2]; // Not Used.
      var trends = response[1][3][0]; // Not Used.
      var dirtySearchResults = response[1][1][0][0];
      processedData = data.replace('$SESSION_ID', ',null,["' + streamID + '"]');
      dirtySearchResults.forEach(function(element, index) {
        var item = {};
        item.type = element[2].toLowerCase();
        item.time = element[30];
        item.url = self._buildProfileURLFromItem(element[21]);
        item.public =  element[32] == '1';
        
        item.owner = {};
        item.owner.name = element[3];
        item.owner.id = element[16];
        item.owner.image = element[18];

        if (element[43]) { // Share?
          item.share = {};
          item.share.name = element[43][0];
          item.share.id = element[43][1];
          item.share.image = element[43][4];
          item.share.html = element[43][4];
          item.share.url = self._buildProfileURLFromItem(element[43][4]);
          item.html = element[47];
        }
        else { // Normal
          item.html = element[4];
        }

        // Parse hangout item.
        if (element[2] == 'Hangout') {
          item.data = {};
          item.data.active = element[82][2][1][0][1] == '' ? false : true;
          item.data.id = element[82][2][1][0][0];
          item.data.participants = [];
          var cachedOnlineUsers = {};
          var onlineParticipants = element[82][2][1][0][3];
          onlineParticipants.forEach(function(elt, index) {
            var user = self._buildUserFromItem(elt[2], elt[0], elt[1], true);
            cachedOnlineUsers[user.id] = true;
            item.data.participants.push(user);
          });
          var offlineParticipants = element[82][2][1][0][4];
          offlineParticipants.forEach(function(elt, index) {
            var user = self._buildUserFromItem(elt[2], elt[0], elt[1], false);
            if (!cachedOnlineUsers[user.id]) {
              item.data.participants.push(user);
            }
          });
        }
        
        // Only add for the specific type.
        if (!extra.type || extra.type == item.type) {
          searchResults.push(item);
        }
      });
      
      // Page the results.
      if (precache > 1) {
        precache--;
        doRequest(searchResults); // Recurse till we are done paging.
      }
      else {
        self._fireCallback(callback, searchResults);
      }
    }, self.QUERY_API, processedData);
  };
  
  var searchResults = [];
  doRequest(searchResults); // Initiate.
};

/**
 * @return {Object.<string, string>} The information from the user.
 *                                    - id
 *                                    - name
 *                                    - email
 *                                    - acl
 */
GooglePlusAPI.prototype.getInfo = function() {
  return this._info;
};

/**
 * @param {function(Object)} callback All the circles.
 */
GooglePlusAPI.prototype.getCircles = function(callback) {
  this._db.getCircleEntity().find({}, callback);
};

/**
 * @param {number} id The circle ID to query.
 * @param {function(Object)} callback All the circles.
 */
GooglePlusAPI.prototype.getCircle = function(id, callback) {
  this._db.getCircleEntity().find({id: id}, callback);
};

/**
 * @param {Object} obj The search object.
 * @param {function(Object)} callback All the circles.
 */
GooglePlusAPI.prototype.getPeople = function(obj, callback) {
  this._db.getPersonEntity().find(obj, callback);
};

/**
 * @param {number} id The person ID.
 * @param {function(Object)} callback The person involved.
 */
GooglePlusAPI.prototype.getPerson = function(id, callback) {
  this._db.getPersonEntity().find({id: id}, callback);
};

/**
 * @param {function(Object)} callback People in my circles.
 */
GooglePlusAPI.prototype.getPeopleInMyCircles = function(callback) {
  this._db.getPersonEntity().find({in_my_circle: 'Y'}, callback);
};

/**
 * @param {number id The person ID.
 * @param {function(Object)} callback The person in my circle.
 */
GooglePlusAPI.prototype.getPersonInMyCircle = function(id, callback) {
  this._db.getPersonEntity().find({in_my_circle: 'Y', id: id}, callback);
};

/**
 * @param {function(Object)} callback The people who added me.
 */
GooglePlusAPI.prototype.getPeopleWhoAddedMe = function(callback) {
  this._db.getPersonEntity().find({added_me: 'Y'}, callback);
};

/**
 * @param {number} id The person ID.
 * @param {function(Object)} callback The person who added me.
 */
GooglePlusAPI.prototype.getPersonWhoAddedMe = function(id, callback) {
  this._db.getPersonEntity().find({added_me: 'Y', id: id}, callback);
};
