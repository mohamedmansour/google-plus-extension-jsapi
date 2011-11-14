An Unofficial Google+ Circle and Followers API for Google Chrome
================================================

It has been 4 months since we have seen any Circle/Posts/Followers
Write/Read API for Google+. Since Google+ is by nature asynchronous
we could tap into their XHR calls and imitate the requests.

I provide you a very basic asynchronous Google+ API, in the current
release, you can do the following:

- Create, Modify, Sort, Query, Remove Circles
- Query, Modify your Profile Information
- Add, Remove, Move People from and to Circles

This is a fully read and write API.

Native Examples:

    // Create an instance of the API.
    var plus = new GooglePlusAPI();

    // Refresh your circle information.
    plus.refreshCircles(function() {

       // Let us see who added me to their circle.
       plus.getPeopleWhoAddedMe(function(people) {
         console.log(people);
       });

       // Let us see who is in my circles.
       plus.getPeopleInMyCircles(function(people) {
         console.log(people);
       });
       
       // Let us see who is in our circles but didn't add us to theirs.
       plus.getDatabase().getPersonEntity().eagerFind({in_my_circle: 'Y', added_me: 'N'}, function(people) {
         console.log(people);
       });
    });
    
As you see, it is pretty easy to query everything. The possibilities are inifinite
since the data is backed up in a WebSQL DataStore, so querying, reporting, etc, would
be super quick.

If you want to place that in an extension, I have created a bridge, so you can use
this in a content script context and extension context safely. To do so, you send a
message as follows:

    // Initialize the API so we get the authorization token.
    chrome.extension.sendRequest({method: 'PlusAPI', data: {service: 'Plus', method: 'init'}}, function(initResponse) {
      chrome.extension.sendRequest({method: 'PlusAPI', data: {service: 'Plus', method: 'refreshCircles'}}, function() {
        // etc ... The method is the same method we defined previously in the raw example.
      });
    });


A full blown example will be released by the end of this week showing how powerful this could be.
As you already know, I am creating a simple circle management utility so you can manage your circles.

Watch this space!


