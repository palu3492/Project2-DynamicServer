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

// GET request handler for '/state/*'
app.get('/state/:selected_state', (req, res) => {
    ReadFile(path.join(template_dir, 'state.html')).then((template) => {
        let response = template;
        // modify `response` here
        response = handleState(response, req);
        WriteHtml(res, response);
    }).catch((err) => {
        Write404Error(res);
    });
});

function handleState(html, req){
    let state = req.params.selected_state;
    html = html.replace(/!!ABBREVIATION!!/g, state);
    db.all("SELECT * FROM Consumption WHERE state_abbreviation = ?", [state], (err, rows) => {
        for(let i = 0; i < rows.length; i++){
            let row = rows[i];
            /*
            coal: 709796,
            natural_gas: 264753,
            nuclear: 86853,
            petroleum: 603795,
            renewable: 95172 },
             */
        }
    });
    return html;
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
