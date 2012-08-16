/**
 * Unofficial Google Plus API. It mainly supports user and circle management.
 *
 * Mohamed Mansour (http://mohamedmansour.com) *
 * @constructor
 */
GooglePlusAPI = function(opt) {
  //------------------------ Constants --------------------------
  // Implemented API
  this.CIRCLE_API              = 'https://plus.google.com/${pagetoken}/_/socialgraph/lookup/circles/?m=true';
  this.FOLLOWERS_API           = 'https://plus.google.com/${pagetoken}/_/socialgraph/lookup/followers/?m=1000000';
  this.FIND_PEOPLE_API         = 'https://plus.google.com/${pagetoken}/_/socialgraph/lookup/find_more_people/?m=10000';
  this.MODIFYMEMBER_MUTATE_API = 'https://plus.google.com/${pagetoken}/_/socialgraph/mutate/modifymemberships/';
  this.REMOVEMEMBER_MUTATE_API = 'https://plus.google.com/${pagetoken}/_/socialgraph/mutate/removemember/';
  this.CREATE_MUTATE_API       = 'https://plus.google.com/${pagetoken}/_/socialgraph/mutate/create/';
  this.PROPERTIES_MUTATE_API   = 'https://plus.google.com/${pagetoken}/_/socialgraph/mutate/properties/';
  this.DELETE_MUTATE_API       = 'https://plus.google.com/${pagetoken}/_/socialgraph/mutate/delete/';
  this.SORT_MUTATE_API         = 'https://plus.google.com/${pagetoken}/_/socialgraph/mutate/sortorder/';
  this.BLOCK_MUTATE_API        = 'https://plus.google.com/${pagetoken}/_/socialgraph/mutate/block_user/';
  this.DELETE_COMMENT_API      = 'https://plus.google.com/${pagetoken}/_/stream/deletecomment/';
  this.INITIAL_DATA_API        = 'https://plus.google.com/${pagetoken}/_/initialdata?key=14';
  this.PROFILE_GET_API         = 'https://plus.google.com/${pagetoken}/_/profiles/get/';
  this.PROFILE_SAVE_API        = 'https://plus.google.com/${pagetoken}/_/profiles/save?_reqid=0';
  this.PROFILE_REPORT_API      = 'https://plus.google.com/${pagetoken}/_/profiles/reportabuse';
  this.QUERY_API               = 'https://plus.google.com/${pagetoken}/_/s/';
  this.LOOKUP_API              = 'https://plus.google.com/${pagetoken}/_/socialgraph/lookup/hovercards/';
  this.ACTIVITY_API            = 'https://plus.google.com/${pagetoken}/_/stream/getactivity/';
  this.ACTIVITIES_API          = 'https://plus.google.com/${pagetoken}/_/stream/getactivities/';
  this.MUTE_ACTIVITY_API       = 'https://plus.google.com/${pagetoken}/_/stream/muteactivity/';
  this.POST_API                = 'https://plus.google.com/${pagetoken}/_/sharebox/post/?spam=20&rt=j';
  this.LINK_DETAILS_API        = 'https://plus.google.com/${pagetoken}/_/sharebox/linkpreview/';
  this.PAGES_API               = 'https://plus.google.com/${pagetoken}/_/pages/get/';

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
  this._pageid = this._opt.pageid;
  this._googleid = this._opt.googleid || 0;
  var dbPostfix = this._googleid + (this._pageid ? '_' + this._pageid : '');
  if (dbPostfix == '0') {
    dbPostfix = '';
  }
  this._db = this._opt.use_mockdb ? new MockDB() : new PlusDB(dbPostfix);

  this._session = null;
  this._info = null;

  // Time between requesting more pages in search resutls.
  this.PRECACHE_INTERVAL = 1000;

  // Time between requesting 'more/burst' search results.
  this.BURST_INTERVAL = 5000;


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
  // We could use eval, but what if Google is untrustworthy?
  //return eval('(' + input + ')');

  var jsonString = input.replace(/\[,/g, '[null,');
  jsonString = jsonString.replace(/,\]/g, ',null]');
  jsonString = jsonString.replace(/,,/g, ',null,');
  jsonString = jsonString.replace(/,,/g, ',null,');
  jsonString = jsonString.replace(/{(\d+):/g, '{"$1":');
  return JSON.parse(jsonString);

};

/**
 * Cleansup the URL by replacing the template variables.
 *
 * @param {string} urlTemplate the URL to parse out the templates.
 */
GooglePlusAPI.prototype._parseURL = function(urlTemplate) {
  var pagetoken = 'u/' + this._googleid;
  if (this._pageid) {
    pagetoken += '/b/' + this._pageid;
  }
  return urlTemplate.replace(/\${pagetoken}/g, pagetoken);
};

/**
 * Sends a request to Google+ through the extension. Does some parsing to fix
 * the data when retrieved.
 *
 * @param {function(Object.<string, Object>)} callback
 * @param {string} urlTemplate The URL template to request.
 * @param {string} postData If specified, it will do a POST with the data.
 * @return {XMLHttpRequest} The created XMLHttpRequest object.
 */
GooglePlusAPI.prototype._requestService = function(callback, urlTemplate, postData) {
  var self = this;
  if (!urlTemplate) {
    callback({error: true, text: 'URL to request is missing.'});
    return;
  }
  
  var url = this._parseURL(urlTemplate);
  
  // When the XHR was successfull, do some post processing to clean up the data.
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
  var error = function(jqXHR, textStatus, errorThrown) {
    if (textStatus == "parsererror") {
      return;
    }
    callback({
      error: errorThrown,
      text: textStatus
    });
  };

  // TODO: This is the only jQuery part, try to convert it to plain old JavaScript so we could
  //       remove the dependency of using the jQuery library!
  var xhr = $.ajax({
    type: postData ? 'POST' : 'GET',
    url: url,
    data: postData || null,
    dataType: 'json',
    async: true,
    complete: success,
    error: error
  });

  return xhr;
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

  if (element[44]) { // Share?
    item.share = {};
    item.share.name = element[44][0];
    item.share.id = element[44][1];
    item.share.image = this._fixImage(element[44][4]);
    item.share.html = element[44][4];
    item.share.url = this._buildProfileURLFromItem(element[44][4]);
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
      item.data.extra_data = hangoutData[15];
      
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
      url: this._parseURL('https://plus.google.com/${pagetoken}/'),
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
    var searchForString = ',"https://csi.gstatic.com/csi","';
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

/**
 * Create a base media item.
 * @param {Media} item A media item. (Media: .href, .mime, .type, .src, .mediaProvider(Optional))
*/
GooglePlusAPI.prototype._createMediaBase = function(item) {
  var mediaDetails = [null,item.href,null,item.mime,item.type];
  
  var mediaItem = JSAPIHelper.nullArray(48);
  mediaItem[9] = [];
  mediaItem[24] = mediaDetails;
  mediaItem[41] = [[null,item.src,null,null],[null,item.src,null,null]];
  mediaItem[47] = [[null,item.mediaProvider || "","http://google.com/profiles/media/provider",""]];
  
  return mediaItem;
};

/**
 * Create a document media item.
 * @param {DocumentMedia} doc A document media item. (DocumentMedia: .href, .type = "document", .mime(Optional), .src(Optional), .mediaProvider(Optional))
*/
GooglePlusAPI.prototype._createMediaDocument = function(doc) {
  doc.mime = doc.mime || "text/html";
  if(!doc.src) {
    if(!doc.domain) {
      var match = doc.href.match(/(\w+\.)+(\w+)/);
      if(match) {
        doc.domain = match[0];
      }
    }
    doc.src = doc.domain ? ("//s2.googleusercontent.com/s2/favicons?domain=" + doc.domain) : null;
  }
  
  var mediaItem = this._createMediaBase(doc);
  
  mediaItem[3] = doc.title || doc.href;
  mediaItem[21] = doc.content || "";
  
  return mediaItem;
};

/**
 * Create an image media item.
 * @param {ImageMedia} item An image media item. (ImageMedia: .type = "photo", .width, .height, .href or .src, .mime(Optional), .mediaProvider(Optional))
*/
GooglePlusAPI.prototype._createMediaImage = function(image) {
  image.mediaProvider = image.mediaProvider || "images";
  image.mime = image.mime || "image/jpeg";
  image.href = image.href || image.src;
  image.src = image.src || image.href;
  var mediaItem = this._createMediaBase(image);
  
  mediaItem[5] = [null,image.src];
  
  var imageDetails = JSAPIHelper.nullArray(9);
  imageDetails[7] = image.width;
  imageDetails[8] = image.height;
  
  mediaItem[24] = mediaItem[24].concat(imageDetails);
  
  return mediaItem;
};

/**
 * Create an array which represents a media item. Can be used for adding new posts.
 * @param {Media} item A media item, either DocumentMedia or ImageMedia.
*/
GooglePlusAPI.prototype._createMediaItem = function(item) {
  switch(item.type) {
    case 'document':
      return this._createMediaDocument(item);
    case 'photo':
      return this._createMediaImage(item);
  }
  return null;
};

/**
 * Create a wire format ACL string.
 *
 * @param {AclItem<Array>} aclItems
 * @return {Object}
 *
 * (AclItem: {GooglePlusAPI.ACL type, String id}, where id is a circle id for ACL.SPECIFIED_CIRCLE,
 *     or a user's id for ACL.SPECIFIED_PERSON)
 */
GooglePlusAPI.prototype._parseAclItems = function(aclItems) {
  var resultAclEntries = aclItems.map(function(aclItem) {
    var selfId = this.getInfo().id;
    if (aclItem.type == GooglePlusAPI.AclType.PUBLIC) {
      return [null, null, 1];
    } else if (aclItem.type == GooglePlusAPI.AclType.EXTENDED_CIRCLES) {
      return [null, null, 4];
    } else if (aclItem.type == GooglePlusAPI.AclType.YOUR_CIRCLES) {
      return [null, null, 3];
    } else if (aclItem.type == GooglePlusAPI.AclType.SPECIFIED_CIRCLE) {
      return [null, aclItem.id];
    } else if (aclItem.type == GooglePlusAPI.AclType.SPECIFIED_PERSON) {
      return [[null, null, aclItem.id]];
    }
  }.bind(this));
  return [resultAclEntries];
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
  var self = this;
  if(this.isAuthenticated()) {
    this.refreshInfo(function() {
        self._fireCallback(callback, {status: true});
    });
  } else {
    this._fireCallback(callback, {status: false});
  }
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
        self._fireCallback(callback, {status: false});
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
            self._fireCallback(callback, {status: true});
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
        self._fireCallback(callback, {status: true});
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
        self._fireCallback(callback, {status: true});
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
      var emailParse = detail[20] && detail[20].match && detail[20].match(/(.+) <(.+)>/);
      if (emailParse) {
        self._info.full_email = emailParse[0];
        self._info.email = emailParse[2];
      }
      self._info.name = detail[1][4][3];
      self._info.id = detail[0];
      self._info.image_url = 'https:' + detail[1][3];
      // TODO: ACL was removes from this request.
      //self._info.acl = '"' + (detail[1][14][0][0]).replace(/"/g, '\\"') + '"';
      self._info.circles = detail[10][1].map(function(element) {
        return {id: element[0], name: element[1]}
      });
      break;
    }
    self._fireCallback(callback, { status: true, data: self._info });
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
        self._fireCallback(callback, {status: true});
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
        self._fireCallback(callback, {status: true});
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
    self._fireCallback(callback, {status: true});
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
 * Deletes a comment.
 * @param {function(boolean)} callback
 * @param {string} commentId The comment id.
 */
GooglePlusAPI.prototype.deleteComment = function(callback, commentId) {
  if (!this._verifySession('commentId', arguments)) {
    return;
  }
  var self = this;
  if (!commentId) {
    self._fireCallback(callback, {status: false, data: 'Missing parameter: commentId'});
  }
  var data = 'commentId=' + commentId + '&at=' + this._getSession();
  this._requestService(function(response) {
    self._fireCallback(callback, {status: !response.error});
  }, this.DELETE_COMMENT_API, data);
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
    self._fireCallback(callback, {status: false, data: 'Invalid ID: Not a number'});
    return;
  }
  this._requestService(function(response) {
    var obj = {
      introduction: response[1][2][14][1]
    };
    self._fireCallback(callback, {status: true, data: obj});
  }, this.PROFILE_GET_API + id);
};

/**
 * Gets a list of pages from the users profile.
 *
 * @param {function(boolean)} callback
 * @param {string} id The profile ID
 */
GooglePlusAPI.prototype.getPages = function(callback) {
  if (!this._verifySession('getPages', arguments)) {
    return;
  }
  var self = this;
  this._requestService(function(response) {
    var dirtyPages = response[1];
    var cleanPages = [];
    if (dirtyPages && dirtyPages.length > 0) {
      dirtyPages.forEach(function(element, i) {
        var page = {};
        page.url =  element[2];
        page.image = self._fixImage(element[3]);
        page.name = element[4][1];
        // page links => element[11][0]
        page.about = element[14][1];
        page.id = element[30];
        page.tagline = element[33][1];
        cleanPages.push(page);
      });
    }
    self._fireCallback(callback, { status: true, data: cleanPages });
  }, this.PAGES_API);
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
  var MAX_SLICE = 12;
  var indexSliced = 0;
  
  // Internal request.
  var doRequest = function() {
    var usersParam = allParams.slice(indexSliced, indexSliced + MAX_SLICE);
    if (usersParam.length == 0) {
      self._fireCallback(callback, { status: true, data: users });
      return;
    }
    indexSliced += usersParam.length;

    var params = '?n=6&m=[[' + usersParam.join(', ') + ']]';
    var data = 'at=' + self._getSession();
    self._requestService(function(response) {
      if (!response || response.error) {
        var error = 'Error during slice ' + indexSliced + '. ' + response.error + ' [' + response.text + ']'; 
        self._fireCallback(callback, { status: false, data: error });
      }
      else {
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
      }
    }, self.LOOKUP_API + params, data);
  };
  doRequest();
};

/**
 * Lookups the activities for the circle or person.
 *
 * @param {function(data)} callback The response for the call, where
 *                                  the parameter is the data for the activities.
 * @param {string} circleID The ID of the circle.
 * @param {string} personID The ID of the person (only used if circleID is not provided).
 * @param {string} pageToken A token recieved in a previous call. A call with this token will fetch
 *                           the next page of activities.
 */
GooglePlusAPI.prototype.lookupActivities = function(callback, circleID, personID, pageToken) {
  if (!this._verifySession('lookupActivities', arguments)) {
    return;
  }
  var self = this;
  pageToken = pageToken || 'null';
  var personCirclePair = (circleID ? 'null,"' + circleID + '"' : '"' + personID + '",null');
  var params = '?f.req=' + encodeURIComponent('[[1,2,' + personCirclePair + ',null,null,null,"social.google.com",[],null,null,null,null,null,null,[]],' + pageToken + ']');
  this._requestService(function(response) {
    var errorExists = !response[1];
    if (errorExists) {
      self._fireCallback(callback, {
        status: false,
        data: []
      });
    } else {
      var dirtyPosts = response[1][0];
      var cleanPosts = [];
      var post = null;
      for (post in dirtyPosts) {
        cleanPosts.push(self._parsePost(dirtyPosts[post]));
      }
      self._fireCallback(callback, {
        status: true,
        data: cleanPosts,
        pageToken: response[1][1]
      });
    }
  }, this.ACTIVITIES_API + params);
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
      data: 'Missing parameters: userID and postID'
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
 * Sets the mute activity for the specific item.
 *
 * @param {function(boolean)} callback
 * @param {string} itemId The item id.
 * @param {boolean} muteStatus True if requires a mute.
 */
GooglePlusAPI.prototype.modifyMute = function(callback, itemId, muteStatus) {
  if (!this._verifySession('setPostMute', arguments)) {
    return;
  }
  var self = this;
  if (!itemId) {
    self._fireCallback(callback, {status: false, data: 'Missing parameter: itemId'});
  }
  var mute = muteStatus || false;
  var data = 'itemId=' + itemId + '&mute=' + mute + '&at=' + this._getSession();
  this._requestService(function(response) {
    self._fireCallback(callback, {status: !response.error});
  }, this.DELETE_COMMENT_API, data);
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
  introduction = introduction ? introduction.replace(/"/g, '\\"') : 'null';

  var acl = JSON.stringify({aclEntries: [
    {scope: scope, role: 20},
    {scope: scope, role: 60}
  ]});
  var data = 'profile=' + encodeURIComponent('[null,null,null,null,null,null,null,null,null,null,null,null,null,null,[[' +
      acl + ',null,null,null,[],1],"' + introduction + '"]]') + '&at=' + this._getSession();

  this._requestService(function(response) {
    self._fireCallback(callback, {status: !response.error});
  }, this.PROFILE_SAVE_API, data);
};

/**
 * Reports a profile as abusive.
 * @param {function(boolean)} callback
 * @param {string} userId The user id to report
 * @param {GooglePlusAPI.AbuseReason} opt_abuseReason The reason to report abuse. Defaults to spam.
 */
GooglePlusAPI.prototype.reportProfile = function(callback, userId, opt_abuseReason) {
  if (!this._verifySession('reportProfile', arguments)) {
    return;
  }
  var self = this;
  if (!userId) {
    self._fireCallback(callback, {status: false, data: 'Missing parameter: userId'});
  }

  var reason = opt_abuseReason || GooglePlusAPI.AbuseReason.SPAM;
  var data = 'itemId=' + userId + '&userInfo=[1]&abuseReport=[' + reason +
      ']&at=' + this._getSession();
  this._requestService(function(response) {
    self._fireCallback(callback, {status: !response.error});
  }, this.PROFILE_REPORT_API, data);
};

// Abuse Reason ENUM. Corresponds to values used by Google+'s abuse report calls.
GooglePlusAPI.AbuseReason = {};
GooglePlusAPI.AbuseReason.SPAM = 1;
GooglePlusAPI.AbuseReason.NUDITY = 2;
GooglePlusAPI.AbuseReason.HATE = 3;
GooglePlusAPI.AbuseReason.FAKE = 8;

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

// ACL type ENUM
GooglePlusAPI.AclType = {};
GooglePlusAPI.AclType.PUBLIC = 1;
GooglePlusAPI.AclType.EXTENDED_CIRCLES = 2;
GooglePlusAPI.AclType.YOUR_CIRCLES = 3;
GooglePlusAPI.AclType.SPECIFIED_CIRCLE = 4;
GooglePlusAPI.AclType.SPECIFIED_PERSON = 5;

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
      // Invalid response exists, it might mean we are doing a lot of searches
      // or it might mean we have finished exhausting the realtime searching.
      var invalidResponse = !response[1] || !response[1][1];
      if (invalidResponse) {
        // This might be an error, prepare the response so the consumer can
        // deal with it.
        var lastResponseObj = {
          data: searchResults,
          status: false,
          mode: mode
        };
        // If it is a real time update, it just means it has completed
        // successfully, no more realtime queries needed.
        // TODO: Perhaps we need to wake it up, not important at this time.
        if (mode === 'rt') {
          lastResponseObj.status = true;
          console.warn('precache:' + precache + ':' + extra.precache,
              'burst_size:' + burst_size + ':' + extra.burst_size, searchResults.length);
        }
        else {
          lastResponseObj.status = false;
          console.warn('precache:' + precache + ':' + extra.precache,
              'burst_size:' + burst_size + ':' + extra.burst_size, searchResults.length);
        }
        self._fireCallback(callback, lastResponseObj);
        return;
      }

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
        // Recurse till we are done paging.
        setTimeout(function() {
          doRequest(searchResults);
        }.bind(this), self.PRECACHE_INTERVAL);
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
    }, self.QUERY_API + mode, processedData);
  };
  
  var searchResults = [];
  doRequest(searchResults); // Initiate.
};

/**
 * Creates a new Google+ Public post on the existing users stream.
 *
 * @param {function(Object)} callback The post has been shared.
 * @param {Object} postObj the object that we are about to post that contains:
 *                            String:content - The content of the new post.
 *                            String:share_id - An existing post to share.
 *                            Media[]:media - An array of media elements.
 *                            RawMedia[]:rawMedia - An array of raw media items in wire format.
 *                                                  This is the output format of fetchLinkMedia.
 *                                                  Overrides the media parameter when present.
 *                            AclItem<Array>:aclItems - An array of acl items describing the
 *                                                      audience of the post. See _parseAclItems
 *                                                      for description.
 *                                                      Defaults to [{type: PUBLIC}] if not present.
 *                            String[]:notify - An array of user IDs to be notified about this post.
 */
GooglePlusAPI.prototype.newPost = function(callback, postObj) {
  if (!this._verifySession('newPost', arguments)) {
    return;
  }

  var content = postObj.content || null;
  var sharedPostId = postObj.share_id || null;
  var media = postObj.media || null;
  var rawMedia = postObj.rawMedia;
  var notify = postObj.notify || [];

  var self = this;
  if (!content && !sharedPostId && !media && !rawMedia) {
    self._fireCallback(callback, {
      status: false,
      data: 'Incomplete parameters: Must pass in content and sharedPostId'
    });
  }

  var sMedia = [];
  if (media && !rawMedia) {
    for (var i in media) {
      sMedia.push(JSON.stringify(this._createMediaItem(media[i])));
    }
  }

  var acl = this._parseAclItems(postObj.aclItems || [{type: GooglePlusAPI.AclType.PUBLIC}]);

  var data = JSAPIHelper.nullArray(37);

  data[0] = content || '';
  data[1] = 'oz:' + this.getInfo().id + '.' + new Date().getTime().toString(16) + '.0';
  data[2] = sharedPostId;
  data[6] = JSON.stringify(postObj.rawMedia || sMedia);
  data[9] = true;
  data[10] = notify.map(function(userId) {
    return [null, userId];
  });
  data[11] = false;
  data[12] = false;
  data[14] = [];
  data[15] = null;
  data[16] = false;
  data[27] = false;
  data[28] = false;
  data[29] = false;
  data[36] = [];
  data[37] = acl;

  var params = 'f.req=' + encodeURIComponent(JSON.stringify(data)) +
      '&at=' + encodeURIComponent(this._getSession());

  this._requestService(function(response) {
    self._fireCallback(callback, {status: !response.error});
  }, this.POST_API, params);
};

/**
 * Fetch MediaDetail objects describing a URL.
 *
 * @param {String} url The url.
 * @return An array containing Media Items, in the same format used by the newPost request.
 */
GooglePlusAPI.prototype.fetchLinkMedia = function(callback, url) {
  if (!this._verifySession('fetchLinkMedia', arguments)) {
    return;
  }
  var self = this;
  var params = "?c=" + encodeURIComponent(url) + "&t=1&slpf=0&ml=1";
  var data = 'susp=false&at=' + this._getSession();
  this._requestService(function(response) {
    if (response.error) {
      self._fireCallback(callback, {status: false, data: response});
    } else {
      // Response contains either a image/video single element at index 3, or an array of elements
      // describing a link at index 2. In any case, both of those indices are arrays of length >= 0.
      var items = response[2].concat(response[3]);
      self._fireCallback(callback, {status: true, data: items});
    }
  }, this.LINK_DETAILS_API + params, data);
};

/**
 * Factory method, creates api instances for all user's identities, including pages.
 *
 * @param function(Object[]) callback
 *
 */
GooglePlusAPI.prototype.getAllIdentitiesApis = function(callback) {
  if (!this.isAuthenticated()) {
    callback([]);
  } else {
    var result = [this];
    var self = this;
    this.getPages(function(response){
      if (response.status) {
        response.data.forEach(function(page) {
          result.push(new GooglePlusAPI({
            googleid: self._googleid,
            pageid: page.id
          }));
        });
      }
      callback(result);
    });
  }
}

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
