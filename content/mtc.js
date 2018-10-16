/**
 * Global variables
 */

const DAY = 24 * 60 * 60 * 1000;

const sleep = (ms) => { return new Promise(resolve => setTimeout(resolve, ms)) }
const get = (p, o) => p.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, o)

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
    /**
     * 
     * @param {String} date 
     * @param {String} student 
     * @param {String} type 
     * @param {String} subject 
     * @param {String} state 
     * @param {String} resources 
     * @param {Element} [row]
     * @param {Number} [price]
     */
    constructor(date, student, type, subject, state, resources, row, price) {
        // Assigned properties
        this.date = date
        this.student = student
        this.type = type
        this.subject = subject
        this.state = state
        this.resources = resources || null
        this.row = row || null

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
        return new Date(this.date)
    }

    getEndTime() {
        let endTime = new Date(this.getStartTime());

        if (this.type.includes("Free Video Meeting")) {
            endTime = new Date(endTime.getTime() + 15 * 60000)
        } else if (this.type.includes("School Tutorial")) {
            endTime = new Date(endTime.getTime() + 55 * 60000)
        } else {
            endTime.setHours(parseInt(this.getStartTime().getHours()) + 1)
        }

        return endTime
    }

    getPaymentDate() {
        return MyTutorCalendar.nextPaymentDate(new Date(this.date))
    }

    getTitle() {
        return `${this.student} - ${this.type} - ${this.subject} (${this.state})`
    }

    getLevel() {
        let level = this.subject.split(" ");
        if (level[level.length - 1] == "Level")
            level = "A-Level"
        else
            level = level[level.length - 1]

        return level
    }

    setPrice(price) {
        this.price = price

        let html = `<td role="gridcell" colspan="1" class="tile__action mtc-lessonPrice"><strong>£${price}</strong></td>`

        let date = this.date.replace(/([a-z])(?=[A-Z])|\s*\b\d{4}\b/g, "")

        // Must modularise soon!
        $(MyTutorCalendar.tables.upcoming).each(
            function (i) {

                if ($(this).find("td").first().children("p").text().trim() != date)
                    return
                if ($(".mtc-lessonPrice", $(this)).length)
					return

                $("td:last", $(this)).before(html)
            }
        );
    }

    static fromRow(cells) {
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

        return new Session(date, student, type, subject, state, resources, cells)
    }
}

Date.prototype.toGoogleCalenderString = function () {
    return this.toISOString().split('.')[0] + "Z"
}

Date.prototype.asInteger = function () {
    const start = new Date(this.getFullYear(), 0, 0);
    const diff = (this - start) + ((start.getTimezoneOffset() - this.getTimezoneOffset()) * 60 * 1000);
    const oneDay = 1000 * 60 * 60 * 24;
    const day = Math.floor(diff / oneDay);

    return day;
}

class MyTutorCalendar {
    constructor() {
        // Constants
        this.ALLOWED_STATES = { rest: "rest", syncing: "syncing" }
        this.SYNCBUTTON_ID = "mtc-sync"
        this.PAYMENTDATE_ID = "mtc-paymentdate"
        this.PAYMENTTOTAL_ID = "mtc-paymenttotal"
        this.PAYMENTTOTALBUTTON_ID = "mtc-paymenttotalbutton"

        // Properties
        this.tutor = $("#container > nav > div > div.column-2.column-3-l.column-4-m > div > a > span").text().trim()
        this.state = this.ALLOWED_STATES.rest

        /**
        * @type {Array.<Session>}
        */
        this.sessions = []

        /**
         * @type {Array.<Session>}
         */
        this.previousSessions = []

        // Bindings
        this.loadMore = $("#classbookingform\\:classbookingtabs\\:loadMoreUpcomingSessions").click((e) => this.sync())

        this.rerfeshUI()
    }

    rerfeshUI() {
        this.showUI()

        this.updateUpcomingPrices()
    }

    /**
     * Handles any incoming messages
     * @param {object} message 
     */
    receivedMessage(message) {
        console.log(message)

        let action = message.action

        if (action == "completed_sync") {
            this.setState("rest")
            toast("Updated calendar!")
        }
    }

    /**
     * Checks if a state is allowed and sets it
     * @param {string} state 
     */
    setState(state = this.state) {

        if (this.ALLOWED_STATES[state]) {
            this.state = state
            this.rerfeshUI()
        } else {
            throw new InvalidStateException(state)
        }
    }

    /**
     * Gets next general payment date. Not to be used for calculating total payments.
     * Payment days are the 3rd and 18th of the month
     * @param {Date} startDate 
     * @return The next payment date
     */
    static nextPaymentDate(startDate = new Date()) {
        let day = startDate.getDate(),
            next = new Date(startDate)

        if (day <= 18) {
            next.setDate(18)
        } else if (day <= 31) {
            next.setMonth(next.getMonth() + 1)
            next.setDate(3)
        }

        return next
    }

    /**
     * Reverse of {@link nextPaymentDate}
     * @param {Date} startdate 
     */
    static previousPaymentDate(startDate = new Date()) {
        let day = startDate.getDate(),
            previous = new Date(startDate)

        if (day <= 18) {
            previous.setDate(3)
        } else if (day <= 31) {
            previous.setMonth(previous.getMonth() - 1)
            previous.setDate(18)
        }

        return previous
    }

    async updateUpcomingPrices() {
        let prices = await PaymentScraper.scrape()

        for (let session of this.sessions) {
            session.setPrice(PaymentScraper.getPriceFromType(prices, session.type, session.level, session.student))
        }

    }

    static get tables() {
        return {
            upcoming: '#upcomingSessions tr[role="row"]',
            previous: '#classbookingform\\:classbookingtabs\\:previousSessionsDataTable_data tr[role="row"]'
        }
    }

    /**
     * Extract data from page and update global sessions.
     */
    updateUpcomingSessions() {
        this.sessions = this.tableToSessions(MyTutorCalendar.tables.upcoming)

        console.log(this.sessions)
    }

    updatePreviousSessions() {
        this.previousSessions = this.tableToSessions(MyTutorCalendar.tables.previous)

        console.log(this.previousSessions)
    }

    /**
     * Will trigger load more previous sessions if it can. Will return when
     * the table has updated.
     */
    async triggerPreviousLoadMore() {
        var button = "#classbookingform\\:classbookingtabs\\:loadMorePreviousSessions"
        try {
            while ($(button).length) {


                $(button).click()

                if (!$(button).length) {
                    break
                }

                while ($(button).attr("class").indexOf("progress") != -1) {
                    await sleep(100)
                }
            }
        } catch (err) {

        }
        console.log("Loaded all previous sessions")
        this.updatePreviousSessions()
        this.rerfeshUI()
    }

    /**
     * WIP function to get the next payment total
     */
    async showNextPaymentTotal() {
        await this.triggerPreviousLoadMore()

        let total = 0,
            prices = await PaymentScraper.scrape()

        let allSessions = this.sessions.concat(this.previousSessions)

        for (let session of allSessions) {
            let date = new Date(session.date)
            if (date.getTime() - MyTutorCalendar.nextPaymentDate().getTime() < 0 &&
                 (date.getTime() - MyTutorCalendar.previousPaymentDate().getTime()) > 0 ) {
                     console.log(session)
                total += PaymentScraper.getPriceFromType(prices, session.type, session.level, session.student)
            }
        }

        $(`#mtc-paymenttotal`).html(` £${total} `)
    }

    /**
     * Calculates the total amount you've been paid by MyTutor.
     */
    async showPaymentTotals() {
        await this.triggerPreviousLoadMore()
        this.showNextPaymentTotal()

        let total = 0
        let monthTotal = 0
        let prices = await PaymentScraper.scrape()

        for (let session of this.previousSessions) {
            total += PaymentScraper.getPriceFromType(prices, session.type, session.level, session.student)
        }

        $("#oneofftutorialsform").html(`To date, you have been paid <strong>£${total}</strong> for <strong>${this.previousSessions.length}</strong> lessons by MyTutor.`)

        $("#oneofftutorialsdlg_Label").text(`Total MyTutor Payments`)
        $("#oneofftutorialsdlg_content > div.modal-header > button").on("click", function() { $('#oneofftutorialsdlg').hide() })

        $('#oneofftutorialsdlg').show()
    }

    /**
     * 
     * @param {String} table 
     * @return {Array.<Session>} array of sessions in the table
     */
    tableToSessions(table) {
        let sessions = []

        $(table).each(
            function (i) {
                const cells = [];

                $('td', $(this)).each(function () {
                    cells.push($(this));
                });

                if (cells[0] === undefined)
                    return

                let session = Session.fromRow(cells);

                sessions.push(session)
            }
        );

        return sessions
    }

    /**
     * Push sessions to Google Calendar
     */
    async sync() {
        this.setState("syncing")

        // Fire syncbutton

        this.updateUpcomingSessions()

        const message = {
            'referrer': 'MyTutorCalendar.sync',
            'action': 'sync',
            'payload': this.sessions
        }

        chrome.runtime.sendMessage(message);
    }

    /**
     * Manages sync button. If it already exists, we can change state.
     * If it doesn't, we create it and manipulate state.
     */
    showUI() {
        // Locale
        const REST = "Sync to Google Calendar"
        const SYNCING = `<i class="fa fa-circle-o-notch fa-spin" style="font-size:24px"></i>`

        const FRAMEWORK = `<div class="column-3 column-3-m column-3-s"><span> &nbsp;</span></div>
                             <div class="column-2 column-2-m column-2-s"><span id="${this.PAYMENTDATE_ID}">&nbsp;</span></div>
                             <div class="column-2 column-2-m column-2-s">
                                <button id="${this.PAYMENTTOTALBUTTON_ID}" class="r_button r_button--xs r_button--secondary" 
                                title="Sync to Google Calendar" aria-disabled="false"><i></i><span>Get Payment Total</span></button>
                            </div>
                                <div class="column-2 column-2-m column-2-s">
                               <button id="${this.SYNCBUTTON_ID}" class="r_button r_button--xs r_button--primary" 
                            title="Sync to Google Calendar" aria-disabled="false"><i></i><span>Sync to Google Calendar</span></button>
                            </div>`

        const APPENDTARGET = 'div.filters > div.row'

        let syncButton = $(`#${this.SYNCBUTTON_ID}`)

        if (!syncButton.length) {
            $(APPENDTARGET).append(FRAMEWORK)
            syncButton = $(`#${this.SYNCBUTTON_ID}`)
            $("body").on('click', `#${this.SYNCBUTTON_ID}`, (e) => { e.preventDefault(); this.sync() })
            $("body").on('click', `#${this.PAYMENTTOTALBUTTON_ID}`, (e) => { e.preventDefault(); this.showPaymentTotals() })

        }

        // Update payment date
        $(`#${this.PAYMENTDATE_ID}`).html(`You'll be paid <span id='${this.PAYMENTTOTAL_ID}'></span> on <br /><span>
                ${MyTutorCalendar.nextPaymentDate().toLocaleDateString("en-GB", { year: 'numeric', month: 'long', day: 'numeric' })}
                 </span>`);

        // Assign button state
        if (this.state == this.ALLOWED_STATES.rest) {
            syncButton.html(REST)
        } else {
            syncButton.html(SYNCING)
        }
    }
}

class PaymentScraper {
    static get paymentUrl() { return "https://www.mytutor.co.uk/tutors/secure/price-band.html" }

    /**
     * @return an Object representing different levels of pay
     */
    static async scrape() {

        let prices = this.buildPricesObject()

        let page = await this.getHtml(this.paymentUrl)

        page = $(page)

        let currentPrices = page.find("#regularpricingtable").find(".pricingtable__header--highlight")

        prices.regular.alevel = this.textPriceToNumber(currentPrices[1].innerText)
        prices.regular.gcse = this.textPriceToNumber(currentPrices[2].innerText)

        for (let i = 1; i < 7; i++) {
            let selectedBand = page.find(`#pb${i}pricingtable`)

            if (selectedBand.length === 0)
                continue

            prices.regular.bands[i] = {}

            let selectedPrices = selectedBand.find(".pricingtable__header--highlight")

            if (selectedPrices.length !== 3)
                continue

            prices.regular.bands[i].alevel = this.textPriceToNumber(selectedPrices[1].innerText)
            prices.regular.bands[i].gcse = this.textPriceToNumber(selectedPrices[2].innerText)
        }

        prices.exceptions = []
        page.find("#cFECF\\:priceBandsForParentTable tr").each(function() { prices.exceptions.push({
            name: $("td:nth-child(2)", $(this)).text().replace(/\./g, ''),
            band: $("td:nth-child(3)", $(this)).text().replace(/\D/g,'')
        }) })

        this.prices = prices

        return prices


    }

    /**
     * Contains the framework for building a new price structure
     * 
     * @return the prices object
     */
    static buildPricesObject() {
        return {
            schools: {
                alevel: 11,
                gcse: 10
            },
            regular: {
                bands: {

                }
            }
        }
    }

    /**
     * Convert a string of currency to Number
     * @param {String} currency 
     */
    static textPriceToNumber(currency) {
        return Number(currency.trim().replace(/[^0-9.-]+/g, ""))
    }

    /**
     * Gets a price for a student
     * @param {Object} prices
     * @param {String} type 
     * @param {String} level 
     * @param {String} student
     * 
     * @return {Number} The correct price, or 0
     */
    static getPriceFromType(prices, type, level, student) {
        if (!prices) return

        if (type == "School Tutorial")
            type = "schools";
        else if (type == "Lesson" || type == "Written Work Review")
            type = "regular";
        else return 0

        if (level == "GCSE" || level == "11+")
            level = "gcse";
        else if (level = "A-Level")
            level = "alevel";
        else return 0

        // Check if there are price exceptions
        if (prices.exceptions != null) {
            for (var i = 0; i < prices.exceptions.length; i++) {
                if (prices.exceptions[i].name == student) {
                    var band = get(["exceptions", i, "band"], prices);
                    var price = get(["regular", "bands", band, level], prices);
                    
                    return price
                }
            }
        }

        // If no price exceptions for this student, then get standard lesson price
        return prices[type][level]

    }


    static getHtml(url) {
        return new Promise((resolve) => {
            var request = new XMLHttpRequest();
            request.open("GET", url);
            request.onreadystatechange = function () {
                if (request.readyState === 4 && request.status === 200) {
                    resolve(request.responseText.trim())
                }
            };
            request.send(null);
        });
    }
}

class Prices {
    constructor() {
        this.bands = {

        }
        this.current = {

        }
    }
}

async function init() {
    window.App = new MyTutorCalendar();

    await window.App.sync()


}

/**
 * Listener for background response
 */

chrome.extension.onMessage.addListener(function (msg) { window.App.receivedMessage(msg); return true; });



/**
 * Initialise
 */
$(document).ready(() => { init() })

