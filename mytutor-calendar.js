var BOOKING_URL = "https://www.mytutor.co.uk/tutors/secure/bookings.html";

// DATES
var PAYMENT_GROUPS_START_DATE = new Date("2018-03-31");
var PAYMENT_GROUPS_LENGTH = 14;
var PAYMENT_GROUPS_GAP_BEFORE_PAY = 3;
var DAY = 24 * 60 * 60 * 1000;

// SETTINGS
var options = {};

// Utilities

chrome.extension.onMessage.addListener(function(msg, sender, sendResponse) {

    if (msg.action == 'finished_sync') {

        if ($('#syncToGoogleCalendar').is(".syncing")) {
            $('#syncToGoogleCalendar').removeClass('syncing');
            $('#syncToGoogleCalendar > i').removeClass('syncing');

            toast("Calendar Updated", "calendar");
        }

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
function initialSetup(price) {

    chrome.storage.sync.get(null, function(settings) {
        $(".mytutor-calendar-element").remove();

        $('div.filters > div.row').append(
            '<div class="column-4 column-4-m column-4-s mytutor-calendar-element"><span> &nbsp;</span></div>'+
            '<div class="column-2 column-2-m column-2-s mytutor-calendar-element"><span id="nextPaymentDate">&nbsp;</span></div>'+
            '    <div class="column-3 column-3-m column-3-s mytutor-calendar-element">'+
            '    <button id="syncToGoogleCalendar" class="r_button r_button--xs r_button--primary" ' +
            'title="Sync to Google Calendar" aria-disabled="false"><i></i><span>Sync to Google Calendar</span></button>'+
            '<button id="mytutorCalendarSettings" class="r_button r_button--xs r_button--default" title="Settings" aria-disabled="false" style="'+
            '"><i class="fa fa-sliders"></i><span></span></button>'+
            
            '</div>'
        );

        var sessions = new Array();

            $('#syncToGoogleCalendar').toggleClass('syncing');

            /**
             * This will rebind the event for load more
             */

            $("#classbookingform\\:classbookingtabs\\:loadMoreUpcomingSessions").on("click", function () {
                setTimeout(function(){
                    initialSetup();
                }, 1000);
            });

            /* Rebind for upcoming tab
            $('body').on('click', 'a[href="#classbookingform\\:classbookingtabs\\:upcomingTab"', function(e) {
                initialSetup();
            });*/

            var nextPaymentDate = getPaymentDate(new Date(), true);

            

            $('#nextPaymentDate').html("You'll be paid <span id='nextPaymentTotal'></span> on <br /><span>"
             + nextPaymentDate.toLocaleDateString("en-GB", {year: 'numeric', month: 'long', day: 'numeric' })
             + "</span>");



            function updateSessions() {
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

                    session.level = session.subject.split(" ");
                    if (session.level[session.level.length - 1] == "Level")
                        session.level = "A-Level"
                    else
                        session.level = session.level[session.level.length - 1];

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

                    session.original = {};
                    session.original.startTime = startTime;
                    session.original.endTime = endTime;

                    session.startTime = startTime.toISOString().split('.')[0]+"Z";
                    session.endTime = endTime.toISOString().split('.')[0]+"Z";

                    session.paymentDate = getPaymentDate(session.original.startTime);                    

                    if (settings.showPrices) {
                        // Tidy up
                        $(".calendarPriceSpan").html("");

                        session.price = getPriceFromType(session.type, session.level, session.student).then(function(data){
                            session.price = data;
                            
                            sub[sub.length - 1].before('<td class="mytutor-calendar-element mytutor-calendar-price-td"><span class="calendarPriceSpan">&#163;'+session.price+'</span></td>');
                        });
                    }

                    console.log(session);

                    sessions.push(session);

                    // Create calendar link
                    var calendars = makeCalendars(session);

                    // Add button to context
                    $(".mytutor-calendar-button").remove();
                    $(".tile__action__wrapper", this).append(createButton(calendars));

                
                });
            }

            updateSessions();

            if (price != null) {
                $('#nextPaymentTotal').html("£" + price)
             } else {
                pastPrices();
             }

            chrome.runtime.sendMessage(sessions, function(response) {
                console.log(response);
            });
        
        $('body').on('click', '#syncToGoogleCalendar', function(e) {
            e.preventDefault();

            // Save this setting
            chrome.storage.sync.set({
                enableSync: true
            });

            $('#syncToGoogleCalendar').toggleClass('syncing');

            updateSessions();

            chrome.runtime.sendMessage(sessions, function(response) {
                console.log(response);
            });


        });

        $('body').on('click', '#mytutorCalendarSettings', function(e) {
            e.preventDefault();

            injectSettingsModal();

        });


    });
}

$(document).ready(function(){

    chrome.storage.sync.get(null, function(data){
        if (data.enableSync == null) {
            chrome.storage.sync.set({
                showPrices: true
            });
        }
    })

    setupPrices(true);

    initialSetup();

    // Check if first time
    

    $("body").append(
        '<div id="settingsModal" data-backdrop="static" data-keyboard="false" class="modal" role="dialog" tabindex="-1" aria-labelledby="unableToCancelLessonModal_Label" aria-hidden="true"><div class="modal-dialog"><div id="unableToCancelLessonModal_content" class="modal-content ">'+
        '<div class="modal-header"><button type="button" class="close" data-dismiss="modal" onclick="$(\'#settingsModal\').css(\'display\',\'none\')"></button></div><div class="modal-body">'+
'		<img class="modal__image" src="">'+
'			<p class="modal__header">MyTutor Calendar Settings</p>'+
'            <label class="switch"><input type="checkbox" data-setting="showPrices"><span class="slider round"></span></label>'+
'           <span class="slider-label" data-setting="showPrices">Show Prices</span>'+
'<br />'+
'            <label class="switch"><input type="checkbox" data-setting="enableSync"><span class="slider round"></span></label>'+
'           <span class="slider-label">Enable Sync</span>'+
'			<p class="modal__subheader">Built by Stewart McGown</p>'+
'		</p></div></div></div></div>'
  
        );

        //Settings

        $("#settingsModal input").change(function() {
            var checked = $(this).prop("checked");
            var setting = $(this).data("setting");

            switch (setting) {
                case "showPrices":
                    chrome.storage.sync.set({
                        showPrices: checked
                    });
                    window.location.reload(true); 
                    if (checked) 
                        showPrices();
                    break;
                case "enableSync":
                    chrome.storage.sync.set({
                        enableSync: checked
                    });
            }
            

        });
});

// Utilities

function getPaymentDate(startTime, getNextPaymentDate) {

    var adjustment = 1;

    if (getNextPaymentDate) {
        adjustment = 0;
    }

    var dayNumber = dayFromDate(startTime);

    var dateGroups = Math.floor((dayNumber-dayFromDate(PAYMENT_GROUPS_START_DATE))/PAYMENT_GROUPS_LENGTH) + adjustment;

    var endOfPaymentGroup = new Date(PAYMENT_GROUPS_START_DATE.getTime() + dateGroups * PAYMENT_GROUPS_LENGTH * DAY)

    var paymentDate = new Date(endOfPaymentGroup.getTime() + PAYMENT_GROUPS_GAP_BEFORE_PAY* DAY);
    
    return paymentDate;
}

function dateFromDay(year, day){
    var date = new Date(year, 0); // initialize a date in `year-01-01`
    return new Date(date.setDate(day)); // add the number of days
}

function dayFromDate(input) {
    var start = new Date(input.getFullYear(), 0, 0);
    var diff = (input - start) + ((start.getTimezoneOffset() - input.getTimezoneOffset()) * 60 * 1000);
    var oneDay = 1000 * 60 * 60 * 24;
    var day = Math.floor(diff / oneDay);

    //console.log(day)
    return day;
}

function getPriceFromType(type, level, student) {

    // Lookup premade price list
    var price = new Promise(function(resolve, reject) {
        chrome.storage.sync.get(['priceExceptions','lessonPrices','bands'], function(settings) {
            // Sanitise
            if (type == "School Tutorial")
                type = "schools";
            else if (type == "Lesson")
                type = "regular";
            
            if (level == "GCSE" || level == "11+")
                level = "gcse";
            else if (level = "A-Level")
                level = "alevel";

            // Check if there are price exceptions
            if (settings.priceExceptions != null) {

                for (var i = 0; i < settings.priceExceptions.length; i++) {
                    if (settings.priceExceptions[i].student == student) {
                        var band = settings.priceExceptions[i].band;
                        var price = settings.bands[band][level];

                        console.log("Student: " + student + ", Band: " + band + ", Price: " + price)
                        resolve(price);
                        return;
                    }
                }

            }

            // If no price exceptions for this student, then get standard lesson price
            if (settings.lessonPrices != null)
                resolve(settings.lessonPrices[type][level])                
            else
                resolve(0);
            
        });
    })

    return price;
    // if 
}

function getHTML(url) {
    return new Promise (function(resolve, reject){
        var request = new XMLHttpRequest(); 
        request.open("GET", url);
        request.onreadystatechange = function() { 
            if (request.readyState === 4 && request.status === 200) {
                resolve(request.responseText.trim())
            }
        };
        request.send(null);
    });
}

// Modals

function injectSettingsModal() {
    $("#settingsModal").show();
    chrome.storage.sync.get(null, function(settings) {
        if (settings.showPrices) {
            $("input[data-setting='showPrices']").prop("checked", settings.showPrices);

            if (settings.lessonPrices == null || settings.priceExceptions) {
                setupPrices();
            }
        } 
        
        if (settings.enableSync) {
            $("input[data-setting='enableSync']").prop("checked", settings.enableSync);
        }

        
    });

}