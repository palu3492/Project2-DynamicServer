// Built-in Node.js modules
var fs = require('fs')
var path = require('path')

// NPM modules
var express = require('express')
var sqlite3 = require('sqlite3')


var public_dir = path.join(__dirname, 'public');
var template_dir = path.join(__dirname, 'templates');
var db_filename = path.join(__dirname, 'db', 'usenergy.sqlite3');

var app = express();
var port = 8000;

// open usenergy.sqlite3 database
var db = new sqlite3.Database(db_filename, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.log('Error opening ' + db_filename);
    }
    else {
        console.log('Now connected to ' + db_filename);
        TestSQL();
    }
});

function TestSQL(){
    db.all("SELECT * FROM Consumption WHERE year =?", ["2017"], (err,rows) =>{
        //console.log(rows);
    });
}

app.use(express.static(public_dir));


// GET request handler for '/'
app.get('/', (req, res) => {
    ReadFile(path.join(template_dir, 'index.html')).then((template) => {
        let response = template;
        db.all("SELECT * FROM Consumption WHERE year =?", ["2017"], (err,rows) =>{
            let coalCount = 0;
            let gasCount = 0;
            let nuclearCount = 0;
            let petroleumCount = 0;
            let renewableCount = 0; 
            let i; 
            
            for (i = 0; i < rows.length; i++){
                
                coalCount += rows[i]['coal'];  
                gasCount += rows[i]['natural_gas'];
                nuclearCount += rows[i]['nuclear']; 
                petroleumCount += rows[i]['petroleum'];
                renewableCount += rows[i]['renewable'];
            }
            
            response = response.replace('!!Coalcount!!', coalCount);
            response = response.replace('!!Gascount!!', gasCount);
            response = response.replace('!!NuclearCount!!', nuclearCount);
            response = response.replace('!!PetroleumCount!!', petroleumCount);
            response = response.replace('!!RenewableCount!!', renewableCount);
            
            
            WriteHtml(res, response);
        });

        
    }).catch((err) => {
        Write404Error(res);
    });
});

// GET request handler for '/year/*'
app.get('/year/:selected_year', (req, res) => {
    ReadFile(path.join(template_dir, 'year.html')).then((template) => {
        let response = template;
        // modify `response` here
        WriteHtml(res, response);
    }).catch((err) => {
        Write404Error(res);
    });
});

// Figured this was easiest way
let statePrevNext = {
    AK:{prev:'WY',next:'AL'},AL:{prev:'AK',next:'AR'},AR:{prev:'AL',next:'AZ'},AZ:{prev:'AR',next:'CA'},
    CA:{prev:'AZ',next:'CO'},CO:{prev:'CA',next:'CT'},CT:{prev:'CO',next:'DC'},DC:{prev:'CT',next:'DE'},
    DE:{prev:'DC',next:'FL'},FL:{prev:'DE',next:'GA'},GA:{prev:'FL',next:'HI'},HI:{prev:'GA',next:'IA'},
    IA:{prev:'HI',next:'ID'},ID:{prev:'IA',next:'IL'},IL:{prev:'ID',next:'IN'},IN:{prev:'IL',next:'KS'},
    KS:{prev:'IN',next:'KY'},KY:{prev:'KS',next:'LA'},LA:{prev:'KY',next:'MA'},MA:{prev:'LA',next:'MD'},
    MD:{prev:'MA',next:'ME'},ME:{prev:'MD',next:'MI'},MI:{prev:'ME',next:'MN'},MN:{prev:'MI',next:'MO'},
    MO:{prev:'MN',next:'MS'},MS:{prev:'MO',next:'MT'},MT:{prev:'MS',next:'NC'},NC:{prev:'MT',next:'ND'},
    ND:{prev:'NC',next:'NE'},NE:{prev:'ND',next:'NH'},NH:{prev:'NE',next:'NJ'},NJ:{prev:'NH',next:'NM'},
    NM:{prev:'NJ',next:'NV'},NV:{prev:'NM',next:'NY'},NY:{prev:'NV',next:'OH'},OH:{prev:'NY',next:'OK'},
    OK:{prev:'OH',next:'OR'},OR:{prev:'OK',next:'PA'},PA:{prev:'OR',next:'RI'},RI:{prev:'PA',next:'SC'},
    SC:{prev:'RI',next:'SD'},SD:{prev:'SC',next:'TN'},TN:{prev:'SD',next:'TX'},TX:{prev:'TN',next:'UT'},
    UT:{prev:'TX',next:'VA'},VA:{prev:'UT',next:'VT'},VT:{prev:'VA',next:'WA'},WA:{prev:'VT',next:'WI'},
    WI:{prev:'WA',next:'WV'},WV:{prev:'WI',next:'WY'},WY:{prev:'WV',next:'AK'}
};

// GET request handler for '/state/*'
app.get('/state/:selected_state', (req, res) => {

    ReadFile(path.join(template_dir, 'state.html')).then((template) => {
        let response = template;
        // modify `response` here

        let stateAbbrName = req.params.selected_state; // Abbreviated state requested
        let stateImagePath = '/images/states/'+stateAbbrName+'.png'; // file path for state image
        response = response.replace(/!!StateAbbrName!!/g, stateAbbrName); // Replace all state abbreviation
        response = response.replace('!!StateImage!!', stateImagePath); // Replace state image src
        response = response.replace('!!StateImageAlt!!', 'State of '+stateAbbrName+' image'); // Replace state image alt

        response = response.replace(/!!PrevStateAbbr!!/g, statePrevNext[stateAbbrName].prev);
        response = response.replace(/!!NextStateAbbr!!/g, statePrevNext[stateAbbrName].next);


        let promise1 = new Promise((resolve, reject) => {
            db.get("SELECT state_name FROM States WHERE state_abbreviation = ?", stateAbbrName, (err, row) => {
                resolve(row.state_name);
            });
        });

        let promise2 = new Promise((resolve, reject) => {
            db.all("SELECT * FROM Consumption WHERE state_abbreviation = ?", stateAbbrName, (err, rows) => {
                resolve(rows);
            });
        });

        Promise.all([promise1, promise2]).then((values) => {
            let stateFullName = values[0]; // full state name
            let rows = values[1]; // state consumption all years

            response = stateFillTemplate(response, rows);
            response = response.replace('!!StateFullName!!', stateFullName); // Add full state name

            WriteHtml(res, response); // write when both promises are done
        })
    }).catch((err) => {
        Write404Error(res);
    });
});

function stateFillTemplate(template, rows){

    let coalCounts = [];
    let naturalGasCounts = [];
    let nuclearCounts = [];
    let petroleumCounts = [];
    let renewableCounts = [];

    // loop through each year
    let tableBody = '';
    for(let i = 0; i < rows.length; i++){
        let row = rows[i];

        // Fill in table
        let total = 0;
        tableBody += '<tr>';
        for(let col of Object.keys(row)){
            if(col !== 'state_abbreviation') {
                tableBody += '<td>' + row[col] + '</td>';
                total += row[col];
            }
        }
        tableBody += '<td>'+total+'</td>';
        tableBody += '</tr>';

        // Push values into array for graph
        coalCounts.push(row.coal);
        naturalGasCounts.push(row.natural_gas);
        nuclearCounts.push(Math.abs(row.nuclear)); // How can there be negative consumption?
        petroleumCounts.push(row.petroleum);
        renewableCounts.push(row.renewable);
    }

    // Replace data in template
    template = template.replace('!!StateTableData!!', tableBody);

    template = template.replace('!!CoalCounts!!', coalCounts);
    template = template.replace('!!GasCounts!!', naturalGasCounts);
    template = template.replace('!!NuclearCounts!!', nuclearCounts);
    template = template.replace('!!PetroleumCounts!!', petroleumCounts);
    template = template.replace('!!RenewableCounts!!', renewableCounts);
    return template;
}

// GET request handler for '/energy-type/*'
app.get('/energy-type/:selected_energy_type', (req, res) => {
    ReadFile(path.join(template_dir, 'energy.html')).then((template) => {
        let response = template;
        // modify `response` here
        WriteHtml(res, response);
    }).catch((err) => {
        Write404Error(res);
    });
});

function ReadFile(filename) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data.toString());
            }
        });
    });
}

function Write404Error(res) {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.write('Error: file not found');
    res.end();
}

function WriteHtml(res, html) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(html);
    res.end();
}


var server = app.listen(port);
