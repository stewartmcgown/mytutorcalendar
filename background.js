class PayloadMisingException extends Error {
    constructor(message) {
        super(message)
        this.name = "PayloadMissingException"
    }
}

class CalendarListMissingException extends Error {
    constructor(message) {
        super(message)
        this.name = "CalendarListMissingException"
    }
}

class Request {
    constructor(method, payload, asyncEnabled = true) {
        this.method = method
        this.payload = payload
        this.async = asyncEnabled
    }

    async asObject() {
        let token = await chrome.identity.getAuthToken({ interactive: true })

        let object = {
            method: this.method,
            async: this.asyncEnabled,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            'contentType': 'json'
        }

        if (this.payload)
            object.body = JSON.stringify(this.payload)

        return object
    }
}

chrome.runtime.onMessage.addListener((message) => {
    main(message)

    // Listener must always return true
    return true;
});

class SyncEngine {
    constructor(sessions, id) {
        // Process message and set up engine
        this.localSessions = sessions

        // Constants
        this.constants = {
            CalendarListEndpoint: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
            CalendarCreateEndpoint: 'https://www.googleapis.com/calendar/v3/calendars',
            CalendarName: 'MyTutor Bookings'
        }
    }

    /**
     * Create calendar and return id
     */

    async createCalendar(name) {
        let post = await new Request("POST", { summary: name }).asObject()

        let calendar = await fetch(
            this.constants.CalendarCreateEndpoint,
            post)

        calendar = await calendar.json()

        return calendar.id
    }

    /**
     * Creates an event
     */

    async createRemoteSession(session) {
        let post = await new Request("POST", {
            start: {
                dateTime: session.time.google.start
            },
            end: {
                dateTime: session.time.google.end
            },
            summary: session.title
        }).asObject()

        let calendar_id = await this.getRemoteID()

        fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendar_id}/events`,
            post);
    }

    /**
     * Returns the id of the remote calendar
     */

    async getRemoteID() {
        let get = await new Request("GET").asObject()

        let response = await fetch(
            this.constants.CalendarListEndpoint,
            get)

        response = await response.json()

        if (response.items) {
            for (var item of response.items) {
                if (item.summary == this.constants.CalendarName) {
                    return item.id
                }
            }

            return await this.createCalendar(this.constants.CalendarName)
        } else {
            throw new CalendarListMissingException()
        }

    }

    /**
     * Returns a copy of all the sessions stored in 
     * the calendar
     */
    async getRemoteSessions() {
        let id = await this.getRemoteID()
        let get = await new Request("GET").asObject()
        let date = new Date().toGoogleCalenderString()

        let events = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${id}/events?timeMin=${date}`,
            get)

        events = await events.json()

        return events
    }

    /**
     * Deletes a remote session
     */
    async deleteRemoteSession(deletion_id) {
        let remote_id = await this.getRemoteID()
        let del = await new Request("DELETE").asObject()

        fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${remote_id}/events/${deletion_id}`,
            del);
    }

    /**
     * Pushes local changes to calendar.
     * 
     * To handle cancellations, we have to make sure we only compare up
     * to the last available time.
     * The sessions are sorted already by time so we just get the final
     * one and extract the time from it.
     * 
     * Then, we must run through the array of local sessions, check
     * if there is a corresponding session in the calendar, and if not,
     * upload an event.
     * 
     * Should there be an event in the remote calendar that is not present
     * in the local one, delete it.
     */
    compareSessions() {
        let final = new Date(this.localSessions[this.localSessions.length - 1].time.start)
        let first = new Date(this.localSessions[0].time.start)

        // Process deletions
        for (var remote of this.remoteSessions.items) {
            let deleted = true

            for (var local of this.localSessions)
                if (remote.start.dateTime == local.time.google.start
                    && remote.summary == local.title) 
                        deleted = false

            if (deleted && final >= new Date(remote.start.dateTime))
                this.deleteRemoteSession(remote.id)
        }

        for (var local of this.localSessions) {
            let matching = false

            for (var remote of this.remoteSessions.items) {
                if (remote.start.dateTime == local.time.google.start
                    && remote.summary == local.title) {
                    // This is an existing event
                    matching = true
                    break      
                    }
            }

            if (!matching) {
                // This is a new session
                this.createRemoteSession(local)
            }

        }


    }


    async sync() {
        this.remoteSessions = await this.getRemoteSessions()

        console.log(this.remoteSessions)

        await this.compareSessions()
    }
}

Date.prototype.toGoogleCalenderString = function () {
    return this.toISOString().split('.')[0] + "Z"
}

function main(message) {
    if (message.action == 'sync') {
        if (message.payload != undefined) {
            let syncEngine = new SyncEngine(message.payload)

            syncEngine.sync()
        } else {
            throw new PayloadMisingException()
        }
    }
}