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
let states = [];
// GET request handler for '/state/*'
app.get('/state/:selected_state', (req, res) => {
    ReadFile(path.join(template_dir, 'state.html')).then((template) => {
        let response = template;
        // modify `response` here

        let stateAbbrName = req.params.selected_state;
        let stateImagePath = '/images/states/'+stateAbbrName+'.png';
        response = response.replace(/!!StateAbbrName!!/g, stateAbbrName); // replace state abbreviation
        response = response.replace('!!StateImage!!', stateImagePath); // replace state image src
        response = response.replace('!!StateImageAlt!!', 'State of '+stateAbbrName+' image'); // replace state image alt

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
            let rows = values[1]; // all years values for a state

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
                nuclearCounts.push(row.nuclear);
                petroleumCounts.push(row.petroleum);
                renewableCounts.push(row.renewable);
            }

            // Pagination
            let prevState = 'ZZ';
            let nextState = 'ZZ';
            response = response.replace(/!!PrevStateAbbr!!/g, prevState);
            response = response.replace(/!!NextStateAbbr!!/g, nextState);



            // Replace data in template
            response = response.replace('!!StateTableData!!', tableBody);
            response = response.replace('!!StateFullName!!', stateFullName);
            response = response.replace('!!CoalCounts!!', coalCounts);
            response = response.replace('!!GasCounts!!', naturalGasCounts);
            response = response.replace('!!NuclearCounts!!', nuclearCounts);
            response = response.replace('!!PetroleumCounts!!', petroleumCounts);
            response = response.replace('!!RenewableCounts!!', renewableCounts);

            WriteHtml(res, response); // write when both promises are done
        })
    }).catch((err) => {
        Write404Error(res);
    });
});

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
