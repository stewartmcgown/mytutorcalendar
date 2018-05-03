var BOOKING_URL = "https://www.mytutor.co.uk/tutors/secure/bookings.html";

// Utilities
chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {

    if (msg.action == 'finished_sync') {
        $('#syncToGoogleCalendar').removeClass('syncing');
        $('#syncToGoogleCalendar > i').removeClass('syncing');

        toast("Successfully updated your calendar!");
    }

    return true;
});

// HTML

function createButton(calendars) {
	var button = '<div class="r_button--dual r_button--dual--single mytutor-calendar-button">'+
'					<a class="r_button r_button--xs r_button--default r_button--more js-dualbutton"></a>'+
'					<div class="r_button__submenu">'+
'					<a target="_blank" href="'+calendars.google+'" class="ui-commandlink ui-widget"><i class="fa fa-google"></i> Add to Google Calendar</a>'+
'					<a target="_blank" download="Calendar.ics" href="data:text/calendar;charset=utf8,' + escape(calendars.apple) + '" class="ui-commandlink ui-widget"><i class="fa fa-apple"></i> Add to iCal</a>'+
'		        </div>';


return button;
}

// Calendars

function makeCalendars(session) {
	var calendars = new Object();

    var startTime = session.startTime.replace(/[^a-zA-Z0-9 ]/g, "");
    var endTime = session.endTime.replace(/[^a-zA-Z0-9 ]/g, "");

	calendars.google = 'https://calendar.google.com/calendar/r/eventedit?'+
			'	text=' + encodeURI(session.fullTitle) +
			'	&dates=' + startTime + '/'+ endTime +
			'	&details=' + BOOKING_URL +
			'	&sprop'+
			'	&sprop=name:';
	
	calendars.apple = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MTC//NONSGML v1.0//EN\n" +
			"BEGIN:VEVENT\nUID:me@google.com\n" +
			"DTSTAMP:20120315T170000Z\n" +
			"ATTENDEE;CN=My Self ;RSVP=FALSE\n" +
			"ORGANIZER;CN=Me\n" +
			"DTSTART:" + startTime +"\n" +
			"DTEND:" + endTime +"\n" +
			"SUMMARY:"+ name + " - " + session.subject + ' (' + session.state + ')' +"\n" +
			"END:VEVENT\n" +
			"END:VCALENDAR";
	
	return calendars;
}


// Prototype
Date.prototype.addHours= function(h){
    this.setHours(parseInt(this.getHours())+parseInt(h));
    return this;
}

// Main

// Check if sync is enabled
$(document).ready(function(){

    chrome.storage.sync.get(['enableSync'], function(items) {
        $('div.filters > div.row').append(
            '<div class="column-7 column-7-m column-7-s"><span> </span></div>'+
            '    <div class="column-2 column-2-m column-2-s">'+
            '    <button id="syncToGoogleCalendar" class="r_button r_button--xs r_button--primary" ' +
            'title="Sync to Google Calendar" aria-disabled="false"><i></i><span>Sync to Google Calendar</span></button>'+
            '</div>'
        );

        var sessions = new Array();

        if (items.enableSync) {
            $('#syncToGoogleCalendar').toggleClass('syncing');
            $('#syncToGoogleCalendar > i').toggleClass('syncing');



            /**
             * This for each method is integral in collecting the actual booking information.
             * The sessions object is created to hold all bookings.
             */
            $('#upcomingSessions tr[role="row"]').each(
                function(i) {
                    var sub = [];
                    $('td', $(this)).each(function () {
                        sub.push($(this)); //log every element found to console output
                    });

                    if (sub[0] == null) {
                        return;
                    }

                    var session = new Object();

                    // Set up attributes
                    session.date = sub[0].children("p").text().trim();
                    session.student = sub[2].text().trim().replace(/[^a-zA-Z ]/g, "");

                    if ($('a' , sub[2]).attr("href") != null)
                        session.resources = "https://www.mytutor.co.uk/tutors/secure/" + $('a' , sub[2]).attr("href");

                    if (sub[3].text().indexOf("-") != -1) {
                        session.type = sub[3].text().split('-')[0].trim();
                        session.subject = sub[3].text().split('-')[1].trim();
                    } else {
                        session.type = "Lesson";
                        session.subject = sub[3].text().trim();
                    }

                    session.state = sub[4].children().children("p").text().trim();
                    session.fullTitle = session.student + " - " + session.type + " - " + session.subject + " (" + session.state + ")";

                    // Times
                    var currentTime = new Date();
                    var n = session.date.lastIndexOf(",");
                    session.date = session.date.substring(0,n)+" "+ currentTime.getFullYear() +session.date.substring(n);

                    var startTime = new Date(session.date);
                    var endTime = new Date(startTime);

                    if (session.type.indexOf("Free Video Meeting") != -1) {
                        endTime = new Date(endTime.getTime() + 15*60000);
                    } else if (session.type.indexOf("School Tutorial") != -1) {
                        endTime = new Date(endTime.getTime() + 55*60000);
                    } else {
                        endTime.setHours(parseInt(startTime.getHours()) + 1);
                    }



                    session.startTime = startTime.toISOString().split('.')[0]+"Z";
                    session.endTime = endTime.toISOString().split('.')[0]+"Z";

                    sessions.push(session);

                    // Create calendar link
                    var calendars = makeCalendars(session);

                    // Add button to context
                    $(".tile__action__wrapper", this).append(createButton(calendars));

                });

            chrome.runtime.sendMessage(sessions, function(response) {
                console.log(response);
            });
        }

        $('body').on('click', '#syncToGoogleCalendar', function(e) {
            e.preventDefault();

            // Save this setting
            chrome.storage.sync.set({
                enableSync: true
            });

            $('#syncToGoogleCalendar').toggleClass('syncing');
            $('#syncToGoogleCalendar > i').toggleClass('syncing');


            chrome.runtime.sendMessage(sessions, function(response) {
                console.log(response);
            });


        });


    });



});


// api

