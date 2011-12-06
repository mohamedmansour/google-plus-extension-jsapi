/**
 * Manages a single instance of the entire application.
 *
 * @author Mohamed Mansour 2011 (http://mohamedmansour.com)
 * @constructor
 */
BackgroundController = function() {
  this.plus = new ContentScriptAPIBridge();
  this.onExtensionLoaded();
};

/**
 * @return the native Plus API. Goes past the content script bridge.
 */
BackgroundController.prototype.getAPI = function() {
  return this.plus.plus;
};

/**
 * Triggered when the extension just loaded. Should be the first thing
 * that happens when chrome loads the extension.
 */
BackgroundController.prototype.onExtensionLoaded = function() {
  var currVersion = chrome.app.getDetails().version;
  var prevVersion = settings.version;
  if (currVersion != prevVersion) {
    // Check if we just installed this extension.
    if (typeof prevVersion == 'undefined') {
      this.onInstall();
    } else {
      this.onUpdate(prevVersion, currVersion);
    }
    settings.version = currVersion;
  }
};

/**
 * Triggered when the extension just installed.
 */
BackgroundController.prototype.onInstall = function() {
};

/**
 * Triggered when the extension just uploaded to a new version. DB Migrations
 * notifications, etc should go here.
 *
 * @param {string} previous The previous version.
 * @param {string} current  The new version updating to.
 */
BackgroundController.prototype.onUpdate = function(previous, current) {
};

/**
 * Initialize the main Background Controller
 */
BackgroundController.prototype.init = function() {
  chrome.extension.onRequest.addListener(this.onExternalRequest.bind(this));
};


/**
 * Listen on requests coming from content scripts.
 *
 * @param {object} request The request object to match data.
 * @param {object} sender The sender object to know what the source it.
 * @param {Function} sendResponse The response callback.
 */
BackgroundController.prototype.onExternalRequest = function(request, sender, sendResponse) {
  if (request.method == 'PlusAPI') { // API Bridge
    this.plus.routeMessage(sendResponse, request.data)
  }
  else if (request.method == 'DataAPI') { // WebStorage
    this.plus.routeMessage(sendResponse, request.data)
  }
  else if (request.method == 'PersistSetting') { // LocalStorage
    settings[request.data.key]  = request.data.value;
  }
  else if (request.method == 'GetSetting') { // LocalStorage
    sendResponse({data: settings[request.data]});
  }
  else {
    sendResponse({});
  }
};