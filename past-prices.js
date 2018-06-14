var wait = ms => new Promise((r, j)=>setTimeout(r, ms))

async function pastPrices() {
    // Apparently this url is constant? What are they doing in there
    // Calling it more than once will keep returning a larger and larger list of past lessons
    // Once a lesson outside of the date range for the payment date is found, stop loading.
    
    // Loop maintainers
    var done = false;
    var c = 0;

    var nextPaymentDate = getPaymentDate(new Date(), true);

    var price = 0;

    var dateSignatures = [];
    while (!done) {
        var newInRefresh = false;

        var rows = $("tbody[id*='previousSessionsDataTable_data'] > tr");

        console.log("Rows at start: " + rows.length)

        rows.each(function(i){
            var sub = [];
            $('td', $(this)).each(function () {
                sub.push($(this)); //log every element found to console output
            });

            if (sub[0] == null)
            return;

            // 100% should modularise this

            var session = {};

            session.date = sub[0].children("p").text().trim();
            session.startTime = new Date(session.date);
            session.student = sub[2].text().trim().replace(/[^a-zA-Z ]/g, "");

            if (sub[3].text().indexOf("-") != -1) {
                session.type = sub[3].text().split('-')[0].trim();
                session.subject = sub[3].text().split('-')[1].trim();
            } else {
                session.type = "Lesson";
                session.subject = sub[3].text().trim();
            }
        
            session.level = session.subject.split(" ");
            if (session.level[session.level.length - 1] == "Level")
                session.level = "A-Level"
            else
                session.level = session.level[session.level.length - 1];

            session.paymentDate = getPaymentDate(session.startTime);                    

            var isNew = true;
            dateSignatures.forEach(element => {
                if (element == session.date) {
                    isNew = false;
                }
            });

            if (session.paymentDate.getTime() == nextPaymentDate.getTime() && isNew) {            
                newInRefresh = true;   
                session.price = getPriceFromType(session.type, session.level, session.student).then(function(data){
                    price += data;
                    
                });

                console.log("Subtotal: " + price)

                dateSignatures.push(session.date)
                
                console.log(session.student + "'s Lesson with paydate " + session.paymentDate + " is in range")
            } else {
                newInRefresh = false;
            }

        });


        if (!newInRefresh) {
            done = true;
        } else {
            // Load more
            $("button[id*='loadMorePreviousSessions']").click();
            await wait(500);
        }
        
        c++;
    }

    // Allows promise to be resolved
    await wait(0)

    if (c == 0)
        $('#nextPaymentTotal').html("£" + price)
    else
        initialSetup(price);
    
}

function showPrices() {
    // Placeholder call
    setupPrices();
}

function setupPrices(callback) {
    var raw = getHTML("https://www.mytutor.co.uk/tutors/secure/price-band.html");
    raw.then(function(html) {
        var dom = $($.parseHTML(html));

        var obj = {
            lessonPrices: {
                regular: {

                },
                schools: {

                }
            },
            priceExceptions: [
                
            ],
            bands: {

            }
        }
        
        dom.find("#regularpricingtable > tbody > tr > td.pricingtable__header.pricingtable__header--highlight").each(function(i) {
            var price = Number($(this).text().trim().replace(/[^0-9\.-]+/g,""));
            
            if (i == 0)
                obj.lessonPrices.regular.alevel = price;
            if (i == 1)
                obj.lessonPrices.regular.gcse = price;
        });

        dom.find("#schoolspricingtable > tbody > tr > td.pricingtable__header.pricingtable__header--highlight").each(function(i){
            var price = Number($(this).text().trim().replace(/[^0-9\.-]+/g,""));

            if (i == 0)
                obj.lessonPrices.schools.alevel = price;
            if (i == 1)
                obj.lessonPrices.schools.gcse = price;

        });

        // Get band prices for exceptions
        dom.find(".pricingtable[id^='pb']").each(function(i){
            // Find band number
            var band = $(this).attr("id").replace(/[^0-9]/g,"");

            obj.bands[band] = {
                alevel: 0,
                gcse: 0
            }

            $(this).find(".pricingtable__header--highlight").each(function(j){
                if (j == 0)
                    return;

                var price = Number($(this).text().trim().replace(/[^0-9\.-]+/g,""));
            
                //console.log("Band: " + band + ", Level: " + j + ", Price: " + price)

                if (j == 1)
                    obj.bands[band].alevel = price;
                if (j == 2)
                    obj.bands[band].gcse = price;
            });
        });
        
        // Add prices for current band
        var currentBand = Number(dom.find("h3:contains('Your selected price is currently')").text().replace(/[^0-9\.-]+/g,""));
        obj.bands[currentBand] = {
            alevel: obj.lessonPrices.regular.alevel,
            gcse: obj.lessonPrices.regular.gcse
        }

        // Price Exceptions
        dom.find("#currentTutorTable_data > tr").each(function(i){
            var sub = [];
            
            $('td', $(this)).each(function () {
                sub.push($(this)); //log every element found to console output
            });

            obj.priceExceptions.push({
                student: sub[1].text().trim().replace(/[^a-zA-Z ]/g, ""),
                parent: sub[0].text().trim().replace(/[^a-zA-Z ]/g, ""),
                band: sub[2].text().trim().replace(/[^0-9]/g, "")
            });
        });

        console.log(obj)
        chrome.storage.sync.set(obj, function() {
            if (callback)
                initialSetup();
        });
    });

}
