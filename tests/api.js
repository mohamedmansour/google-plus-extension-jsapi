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
    stop(4000);
    plus.init(function(res) {
      ok(res.status, 'initialized');
      start();
    });
  });

  test('Fetch just circles', function() {
    expect(4);
    stop(5000);
    var counter = 3;
    function done() { --counter || start(); }
    plus.refreshCircles(function(res) {
      ok(res.status, 'refreshed just circles');
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
    expect(9);
    stop(3000);
    var counter = 2;
    function done() { --counter || start(); }
    plus.lookupUsers(function(resp) {
      var data = resp.data;
      ok(resp.status, 'Response valid');
      var user = data['116805285176805120365'];
      ok(user, 'User fetched ok');
      equals(user.data.name, 'Mohamed Mansour', 'My name');
      ok(user.circles.length > 0, 'Circle exists');
      done();
    }, '116805285176805120365', true);
    
    plus.lookupUsers(function(resp) {
      var data = resp.data;
      ok(resp.status, 'Response valid');
      var userA = data['116805285176805120365'];
      var userB = data['117791034087176894458'];
      ok(userA, 'UserA fetched ok');
      ok(userB, 'UserB fetched ok');
      equals(userA.data.name, 'Mohamed Mansour', 'UserA name');
      equals(userB.data.name, 'John Barrington Craggs', 'UserB name');
      done();
    }, ['116805285176805120365', '117791034087176894458', '116805285176805120365', '116805285176805120365', '116805285176805120365',
        '116805285176805120365', '116805285176805120365', '116805285176805120365', '116805285176805120365', '116805285176805120365',
        '116805285176805120365', '116805285176805120365', '116805285176805120365', '116805285176805120365', '116805285176805120365',
        '116805285176805120365', '116805285176805120365', '116805285176805120365', '116805285176805120365', '116805285176805120365',
        '116805285176805120365', '116805285176805120365', '116805285176805120365', '116805285176805120365', '116805285176805120365']);
  });

  test('Current User Info', function() {
    expect(4);
    stop(2000);
    plus.refreshInfo(function(res) {
      ok(res.status, 'Info received');
      //ok(res.data.acl.indexOf('"{\\"aclEntries\\":[{\\"') == 0, 'Access Control List exists');
      ok(res.data.circles.length > 0, 'Circle exists');
      ok(res.data.id.match(/\d+/), 'User id valid');
      ok(res.data.full_email.indexOf(res.data.email) > 0, 'Email exists');
      //equals(plus.getInfo().acl, res.data.acl, 'ACL are the same');
      start();
    }, '116805285176805120365', true);
  });
  
  test('Find Post', function() {
    expect(10);
    stop(2000);
    var counter = 2;
    function done() { --counter || start(); }
    plus.lookupPost(function(res) {
      ok(res.data.is_public);
      equals(res.data.html, 'Trey Ratcliff hung out with 11 people.');
      equals(res.data.type, 'hangout', 'Post is a hangout type');
      equals(res.data.owner.id, '105237212888595777019', 'Hangout owner id');
      equals(res.data.owner.name, 'Trey Ratcliff', 'Hangout owner');
      equals(res.data.data.active, false, 'Hangout is not active');
      equals(res.data.url, 'http://plus.google.com/105237212888595777019/posts/NRZNtwRpB4f');
      equals(res.data.data.type, 2, 'OnAir Hangout');
      done();
    }, '105237212888595777019', 'NRZNtwRpB4f');
    
    plus.lookupPost(function(res) {
      ok(!res.status, 'Error Occurred' );
      equals(res.data, '400 - Bad Request' );
      done();
    }, '116805285176805120365', 'MYcz4xJRvDr');

  });

  /*
  test('Fetch link media', function() {
    expect(8);
    stop(2000);
    var counter = 2;
    function done() { --counter || start(); }
    plus.fetchLinkMedia(function(res) {
      ok(res.status);
      var data = res.data;
      equals(data[0][3], 'Is the internet down?', 'Title is as expected');
      ok(data[0][21].match('Reload! Reload! Reload!'), 'Description is as expected');
      equals(data[0][24][3], 'text/html', 'Mime type is as expected');
      done();
    }, 'http://istheinternetdown.com/');

    plus.fetchLinkMedia(function(res) {
      ok(res.status);
      var data = res.data;
      equals(data[0][3], 'Rick Astley - Never Gonna Give You Up', 'Title is as expected');
      ok(data[0][21].match('Music video by Rick Astley'), 'Description is as expected');
      equals(data[0][24][3], 'application/x-shockwave-flash', 'Mime type is as expected');
      done();
    }, 'http://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });
  */
});
