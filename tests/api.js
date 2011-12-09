$(document).ready(function() {
  var plus = new GooglePlusAPI();

  module('module');
  
  test('JAPI Helper Arrays', function() {
    expect(11);
    stop(2000);
    var smartEquals = function(actual, expected) {
      if (Array.isArray(expected)) {
        expected = expected.join(',');
      }
      if (Array.isArray(actual)) {
        actual = actual.join(',');
      }
      equals(actual, expected);
    };
    smartEquals(JSAPIHelper.searchArray(null, ['foo', 'hi']), false);
    smartEquals(JSAPIHelper.searchArray(null, ['foo', null]), 1);
    smartEquals(JSAPIHelper.searchArray(null, null), false);
    smartEquals(JSAPIHelper.searchArray('hi', ['foo', 'hi']), [1]);
    smartEquals(JSAPIHelper.searchArray('hi', ['foo', ['hi', 'bar']]), [1, 0]);
    smartEquals(JSAPIHelper.searchArray('hi', ['foo', ['test', ['1', '2'], ['hi', 'hie']]]), [1, 2, 0]);
    smartEquals(JSAPIHelper.firstDifference('abcd', 'abcd'), false);
    smartEquals(JSAPIHelper.firstDifference('abcd', 'abcde'), 4);
    smartEquals(JSAPIHelper.firstDifference('abbd', 'abcd'), 2);
    smartEquals(JSAPIHelper.firstDifference('a', 'abbb'), 1);
    smartEquals(JSAPIHelper.firstDifference(null, 'a'), false);
    start();
  });
  
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
    expect(7);
    stop(2000);
    var counter = 2;
    function done() { --counter || start(); }
    plus.lookupUsers(function(data) {
      var user = data['116805285176805120365'];
      ok(user, 'User fetched ok');
      equals(user.data.name, 'Mohamed Mansour', 'My name');
      ok(user.circles.length > 0, 'Circle exists');
      done();
    }, '116805285176805120365', true);
    
    plus.lookupUsers(function(data) {
      var userA = data['116805285176805120365'];
      var userB = data['117791034087176894458'];
      ok(userA, 'UserA fetched ok');
      ok(userB, 'UserB fetched ok');
      equals(userA.data.name, 'Mohamed Mansour', 'UserA name');
      equals(userB.data.name, 'John Barrington Craggs', 'UserB name');
      done();
    }, ['116805285176805120365', '117791034087176894458']);
  });

  test('Current User Info', function() {
    expect(6);
    stop(2000);
    plus.refreshInfo(function(res) {
      ok(res.status, 'Info received');
      ok(res.data.acl.indexOf('"{\\"aclEntries\\":[{\\"') == 0, 'Access Control List exists');
      ok(res.data.circles.length > 0, 'Circle exists');
      ok(res.data.id.match(/\d+/), 'User id valid');
      ok(res.data.full_email.indexOf(res.data.email) > 0, 'Email exists');
      equals(plus.getInfo().acl, res.data.acl, 'ACL are the same');
      start();
    }, '116805285176805120365', true);
  });
});