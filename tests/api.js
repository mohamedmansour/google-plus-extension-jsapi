$(document).ready(function() {
  var plus = new GooglePlusAPI();

  module('module');

  test('Setup', function() {
    expect(1);
    stop(2000);
    plus.getDatabase().clearAll(function() {
      ok(true, 'database wiped');
      start();
    });
  });

  test('Init Plus Api', function() {
    expect(1);
    stop(2000);
    plus.init(function(status) {
      equals(status, true, 'initialized');
      start();
    });
  });

  test('Fetch just circles', function() {
    expect(4);
    stop(5000);
    var counter = 3;
    function done() { --counter || start(); }
    plus.refreshCircles(function(status) {
      equals(status, true, 'refreshed just circles');
      plus.getDatabase().getCircleEntity().count({}, function(count) {
        ok(count.data > 0, 'Contains Circles');
        done();
      });
      plus.getDatabase().getPersonEntity().count({}, function(count) {
        equals(count.data, 0, 'Contains People');
        done();
      });
      plus.getDatabase().getPersonCircleEntity().count({}, function(count) {
        equals(count.data, 0, 'Contains Circle People');
        done();
      });
    }, true);
  });

  test('Lookup User Info', function() {
    expect(2);
    stop(2000);
    plus.lookupUser(function(data) {
      equals(data.user.name, 'Mohamed Mansour', 'My name');
      ok(data.circles.length > 0, 'Circle exists');
      start();
    }, '116805285176805120365', true);
  });
});