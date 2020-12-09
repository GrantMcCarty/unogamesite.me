var path = require('path');
const port = process.env.PORT || 3030;

const express = require('express');
const app = express();

const fs = require('fs');

const bodyParser = require("body-parser");

'use strict';
var crypto = require('crypto');

let players = new Array();
let table1;
let table2;

var currentUser;
var gameStarted = false;
var player1turn = true;

/** bodyParser.urlencoded(options)
 * Parses the text as URL encoded data (which is how browsers tend to send form data from regular forms set to POST)
 * and exposes the resulting object (containing the keys and values) on req.body
 */
app.use(bodyParser.urlencoded({
    extended: true
}));

/**bodyParser.json(options)
 * Parses the text as JSON and exposes the resulting object on req.body.
 */
app.use(bodyParser.json());

//Set the base path to the angular-test dist folder
app.use(express.static(path.join(__dirname, 'dist/GameSite')));

//source: https://levelup.gitconnected.com/simple-application-with-angular-6-node-js-express-2873304fff0f
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.post('/api/sendToken', function(req, res) {
    res.json({'token': req.body.token + "-002"});
});

app.post('/api/login', function(req, res) {
    console.log(JSON.stringify(req.body))
    addPlayer(req.body.user)  
    res.json({'valid': checkUserFile("userFile.txt", req.body.user, req.body.password)});
});

app.post('/api/logout', function(req, res) {
    console.log(JSON.stringify(req.body))
    currentUser = null;
    if(players[0] === req.body.user || players[1] === req.body.user)
        resetGame();
    removePlayer(req.body.user);
});

app.get('/api/get-players', function(req, res) {
    res.send(players)
});

app.get('/api/get-user', function(req, res) {
    res.send(currentUser)
});

app.post('/api/createUser', function(req, res) {
    console.log(JSON.stringify(req.body))
    var pw = saltHashPassword(req.body.password)
    res.json({'valid': writeTextFile("userFile.txt", req.body.user, pw)});
});

app.post('/api/sendTable', function (req, res) {
    if((!players[0] && req.body.player != players[1]) || (!players[1] && req.body.player != players[0])) players.push(req.body.player)
    if(players[0] === req.body.player)
        table1 = req.body.table
    else if(players[1] === req.body.player)
        table2 = req.body.table
    if(table1 && table2) {
        console.log("started!\n" + table1 +"\n"+table2);
        gameStarted = true;
    }
})

app.post('/api/getTable', function(req, res){
    if(req.body.player == players[0]) res.json({'table': table1, 'table2': table2})
    else if(req.body.player == players[1]) res.json({'table': table2, 'table2': table1})
})

app.post('/api/make-guess', function(req, res) {
    console.log("started: "+gameStarted+"\nreceived guess: " + req.body.player + " " + req.body.column + req.body.label+"\n")
    var winner = null;
    if(gameStarted) {
        if(player1turn && req.body.player === players[0]) {
            console.log("Table2 at guess: " + table2[req.body.label][req.body.column])
            if(table2[req.body.label][req.body.column] != "" && table2[req.body.label][req.body.column] != "MISS") {
                table2[req.body.label][req.body.column] = 'HIT';
            }
            else table2[req.body.label][req.body.column] = 'MISS';
            player1turn = false;
        }
        else if(!player1turn && req.body.player === players[1]) {
            console.log("Table at guess: " + table1[req.body.label][req.body.column])
            if(table1[req.body.label][req.body.column] != "" && table1[req.body.label][req.body.column] != "MISS") {
                table1[req.body.label][req.body.column] = 'HIT';
            }
            else table1[req.body.label][req.body.column] = 'MISS';
            player1turn = true;
        }
        console.log("Hit or miss")
        console.log(table1)
        console.log(table2)
        winner = checkWinner();
    }
    if(winner != null) res.json({'winner': winner});
})

app.get('/api/reset-game', function(req, res) {
    resetGame();
})

app.get('/api/gameStarted', function(req, res) {
    res.json({'started':gameStarted})
})

//Any routes will be redirected to the angular app
app.get('*', function(req, res) {
    res.sendFile(path.join(__dirname, 'dist/GameSite/index.html'));
});

//Starting server on port 3030
app.listen(port, () => {
    console.log('Server started!');
    console.log(port);
});

function checkWinner() {
    player1win = true;
    player2win = true;
    for(var x = 0; x < table1.length; x++)
        for(var y = 0; y < table1[x].length; y++) {
            if(table1[x][y] != '' || table1[x][y] != 'MISS' || table1[x][y] != 'HIT')
                player1win = false;
            if(table2[x][y] != '' || table2[x][y] != 'MISS' || table2[x][y] != 'HIT')
                player2win = false;
            if(!player1win && !player2win)
                break;
        }
    if(player1win)
        return players[0];
    if(player2win)
        return players[1];
    return null;
}

function resetGame() {
    table1 = null;
    table2 = null;
    gameStarted = false;
    player1turn = true;
    for(var x = 0; x < players.length; x++)
        players.pop();
}

function removePlayer(user) {
    players = players.filter(word => word != user);
}

function addPlayer(user) {
    if(players.length < 2)
        players.push(user)
}

function checkUserFile(file, user, password)
{
    let foundUser = false;
    let str = fs.readFileSync(file,'utf8');
    var line = str.split('\n');
    for(let x = 0; x < line.length; x++) {
        var string = line[x].split("- ");
        for(let y = 0; y < string.length; y++) {
        if(foundUser) {
            var salt = string[y].slice(0,15);
            var pwValue = sha512(password, salt);
            console.log(pwValue)
            if(string[y] == pwValue.salt + pwValue.passwordHash) {
                currentUser = user;
                return true; 
            }
        }
        foundUser = (string[y] == user);
        }
    }
    return false;
}

function findUser(file, user) {
    let str = fs.readFileSync(file,'utf8');
    var line = str.split('\n');
    for(let x = 0; x < line.length; x++) {
        if(line[x].includes(user+"- ")) {
            return true;
        }
    }
    return false;
}

function writeTextFile(file, username, password)
{
  if(!findUser(file, username)) {
    fs.appendFileSync(file, username+"- "+password+'\n', "utf8");
    currentUser = username;
    return true;
  }
  return false;
}

var genRandomString = function(length) {
    return crypto.randomBytes(Math.ceil(length/2)).toString('hex').slice(0, length);
}

var sha512 = function(password, salt){
    var hash = crypto.createHmac('sha512', salt);
    hash.update(password);
    var value = hash.digest('hex');
    return {
        salt:salt,
        passwordHash:value
    };
};

function saltHashPassword(userpassword) {
    var salt = genRandomString(15);
    var passwordData = sha512(userpassword, salt);
    return passwordData.salt + passwordData.passwordHash;
}