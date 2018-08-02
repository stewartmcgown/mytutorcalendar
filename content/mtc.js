/**
 * Global variables
 */

const PAYMENT_FIRST_DATE = new Date("2018-04-17");
const PAYMENT_GROUPS_START_DATE = new Date("2018-03-31");
const PAYMENT_GROUPS_LENGTH = 14;
const PAYMENT_GROUPS_GAP_BEFORE_PAY = 3;
const DAY = 24 * 60 * 60 * 1000;

/**
 * Errors
 */

class InvalidStateException extends Error {
    constructor(state) {
        super(state)
        this.name = "InvalidStateException"
        this.message = `${state} is not a valid state.`
    }
}

/**
 * A session is one lesson.
 */
class Session {
    constructor(date, student, type, subject, state, resources) {
        // Assigned properties
        this.date = date
        this.student = student
        this.type = type
        this.subject = subject
        this.state = state
        this.resources = resources

        // Computed properties
        this.time = {
            start: this.getStartTime().toDateString(),
            end: this.getEndTime().toDateString(),
            google: {
                start: this.getStartTime().toGoogleCalenderString(),
                end: this.getEndTime().toGoogleCalenderString()
            }
        }
        this.paymentDate = this.getPaymentDate()
        this.title = this.getTitle()
        this.level = this.getLevel()
    }

    getStartTime() {
        return new Date(this.date);
    }

    getEndTime() {
        let endTime = new Date(this.getStartTime());

        if (this.type.includes("Free Video Meeting")) {
            endTime = new Date(endTime.getTime() + 15 * 60000);
        } else if (this.type.includes("School Tutorial")) {
            endTime = new Date(endTime.getTime() + 55 * 60000);
        } else {
            endTime.setHours(parseInt(this.getStartTime().getHours()) + 1);
        }

        return endTime
    }

    getPaymentDate() {
        const dayNumber = this.getStartTime().asInteger();

        const dateGroups = Math.ceil((dayNumber - PAYMENT_GROUPS_START_DATE.asInteger()) / PAYMENT_GROUPS_LENGTH);

        const endOfPaymentGroup = new Date(PAYMENT_GROUPS_START_DATE.getTime() + dateGroups * PAYMENT_GROUPS_LENGTH * DAY);

        const paymentDate = new Date(endOfPaymentGroup.getTime() + PAYMENT_GROUPS_GAP_BEFORE_PAY * DAY);

        return paymentDate;
    }

    getTitle() {
        return `${this.student} - ${this.type} - ${this.subject} (${this.state})`
    }

    getLevel() {
        let level = this.subject.split(" ");
        if (level[level.length - 1] == "Level")
            level = "A-Level"
        else
            level = level[level.length - 1];

        return level
    }
}

Date.prototype.toGoogleCalenderString = function () {
    return this.toISOString().split('.')[0] + "Z"
}

Date.prototype.asInteger = function() {
    const start = new Date(this.getFullYear(), 0, 0);
    const diff = (this - start) + ((start.getTimezoneOffset() - this.getTimezoneOffset()) * 60 * 1000);
    const oneDay = 1000 * 60 * 60 * 24;
    const day = Math.floor(diff / oneDay);

    //console.log(day)
    return day;
}

function get_next_chronological_payment_date(startDate = new Date()) {
    const startDateNumber = startDate.asInteger();

    const yearBeginNumber = PAYMENT_FIRST_DATE.asInteger();

    const gap = startDateNumber - yearBeginNumber;

    const noGroups = Math.ceil(gap / PAYMENT_GROUPS_LENGTH);

    const paymentDate = new Date(PAYMENT_FIRST_DATE.getTime() + noGroups * PAYMENT_GROUPS_LENGTH * DAY);

    return paymentDate;
}

Session.fromRow = cells => {
    // Process date
    let date = cells[0].children("p").text().trim();
    const currentTime = new Date();
    const n = date.lastIndexOf(",");
    date = `${date.substring(0, n)} ${currentTime.getFullYear()}${date.substring(n)}`;

    const student = cells[2].text().trim().replace(/[^a-zA-Z ]/g, "");

    let resources = "";
    if ($('a', cells[2]).attr("href") != null)
        resources = `https://www.mytutor.co.uk/tutors/secure/${$('a', cells[2]).attr("href")}`;

    let type = "";
    let subject = "";
    if (cells[3].text().includes("-")) {
        type = cells[3].text().split('-')[0].trim();
        subject = cells[3].text().split('-')[1].trim();
    } else {
        type = "Lesson";
        subject = cells[3].text().trim();
    }

    const state = cells[4].children().children("p").text().trim();

    return new Session(date, student, type, subject, state, resources)
}

class MyTutorCalendar {
    constructor() {
        this.tutor = $("#container > nav > div > div.column-2.column-3-l.column-4-m > div > a > span").text().trim()
        this.state = "rest"
        this.sessions = []

        // Handle syncing button
    }



    /**
     * Checks if a state is allowed and sets it
     */
    setState(state=this.state) {
        const STATES = ["rest", "syncing"]

        if (STATES.includes(state)) {
            this.state = state
        } else {
            throw new InvalidStateException(state)
        }
    }

    /**
     * Extract data from page and update global sessions.
     */
    update() {
        // Empty global sessions
        this.sessions = []

        const tables = {
            upcoming: '#upcomingSessions tr[role="row"]',
            previous: '#classbookingform\\:classbookingtabs\\:previousSessionsDataTable_data tr[role="row"]'
        }

        $(tables.upcoming).each(
            function (i) {
                const cells = [];

                $('td', $(this)).each(function () {
                    cells.push($(this));
                });

                if (cells[0] == undefined)
                    return

                const session = Session.fromRow(cells);

                window.App.sessions.push(session)
            }
        );

        console.log(this.sessions)
    }

    /**
     * Push sessions to Google Calendar
     */
    sync() {
        const message = {
            'referrer': 'SyncEngine.prototype.sync',
            'action': 'sync',
            'payload': this.sessions
        }

        chrome.runtime.sendMessage(message, response => {
            console.log(response)
        });

    }

    appendCalendars() {
        for (var session of this.sessions) {
            
        }
    }
}

function init() {
    window.App = new MyTutorCalendar();

    window.App.update()

    window.App.sync()
}

$(document).ready(() => { init() })