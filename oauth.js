window.onload = function() {
      chrome.identity.getAuthToken({interactive: true}, function(token) {
        let init = {
          method: 'GET',
          async: true,
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          'contentType': 'json'
        };
        fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            init)
            .then((response) => response.json())
            .then(function(data) {
              console.log(data)
            });
      });
  };