/**
 * Content Script to Background Bridge that delegates asynchronous events
 * to the consumer responsible. This is where all the API hooks should go and
 * only one instence of the GAPI should be present.
 */
ContentScriptAPIBridge = function() {
  this.plus = new GooglePlusAPI();
  this.data = {
    'circle'        : this.plus.getDatabase().getCircleEntity(),
    'person'        : this.plus.getDatabase().getPersonEntity(),
    'person_circle' : this.plus.getDatabase().getPersonCircleEntity()
  }
};

/**
 * Routes messages back to the content script.
 * @param {Function<Object>} callback The listener to call when the service
 *                           has completed successfully.
 * @param {Object} data The data to send to the specified service.
 */
ContentScriptAPIBridge.prototype.routeMessage = function(callback, data) {
  switch (data.service) {
    case 'DeleteDatabase':
      this.plus.getDatabase().clearAll(callback);
      break;
    case 'CountMetric':
      var self = this;
      self.plus.getDatabase().getCircleEntity().count({}, function(circleData) {
        self.plus.getDatabase().getPersonEntity().count({}, function(personData) {
          self.plus.getDatabase().getPersonCircleEntity().count({}, function(personCircleData) {
            self.fireCallback(callback, circleData.data + personData.data + personCircleData.data);
          });
        });
      });
      break;
    case 'Plus':
      var args = [];
      if (callback) args.push(callback);
      if (data.arguments) args.concat(data.arguments);
      this.plus[data.method].apply(this.plus, args);
      break;
    case 'Database':
      var entity = this.data[data.entity];
      // TODO: use the below routine, destroy needs refactoring.
      // entity[data.method](data.attributes, callback);
      switch (data.method) {
        case 'read':
          entity.find(data.attributes, callback);
          break;
        case 'create':
          entity.create(data.attributes, callback);
          break;
        case 'update':
          entity.update(data.attributes, callback);
          break;
        case 'delete':
          entity.destroy(data.attributes.id, callback);
          break;
      }
      break;
    default:
      this.fireCallback(callback, false);
      break;
  }
};

/**
 * Helper to not fire callback if not called.
 * @see {routeMessage}
 */
ContentScriptAPIBridge.prototype.fireCallback = function(callback, data) {
  if (callback) callback(data);
};
