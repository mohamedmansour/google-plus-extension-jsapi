$(document).ready(function() {
  var plus = new GooglePlusAPI();
  
  module('module');
  
  test ('Setup', function() {
    plus.getDatabase().clearAll(function() {
      ok(true, 'database wiped');
    });
  });
  
  test ('Init Plus Api', function() {
    plus.init(function(status) {
      equals(status, true, 'initialized');
    });
  });
  
  test('Fetch just circles', function() {
    plus.refreshCircles(function(status) {
      equals(status, true, 'refreshed just circles');
      plus.getDatabase().getCircleEntity().count({}, function(count) {
        ok(count.data < 0, 'Contains Circles');
      });
      plus.getDatabase().getPersonEntity().count({}, function(count) {
        equals(count.data, 0, 'Contains Peeople');
      });
      plus.getDatabase().getPersonCircleEntity().count({}, function(count) {
        equals(count.data, 0, 'Contains Peeople');
      });
    }, true);
  });
});