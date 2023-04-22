/* SERVER */
var express = require('express')
var app = express()
const port = process.env.PORT || 3000;
var crypto = require("crypto");
const https = require('https')
const mysql = require('mysql2/promise');
var config = require('./dbConfig')
var moment = require('moment'); // require
const helpers = require('./helpers');

const multer = require('multer');
const path = require('path');
const fs = require('fs')

var bodyParser = require('body-parser');
var urlencodedParser = app.use(bodyParser.urlencoded({ extended: true }));
var jsonParser = bodyParser.json()

function sendHeaders(res) {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
    res.setHeader("Access-Control-Allow-Origin", "*");
}

//const hostname = `https://exodusdevelop.com:${port}`
const hostname = `http://localhost:${port}`

function closeConnection(conn) {
    conn.end(function(err) {
        if (err) {
            return console.log('error:' + err.message);
        }
        console.log('Close the database connection.');
    });
}

/* APP BODY */

app.use('/files', express.static(path.join(__dirname, 'files')))

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'files/');
    },
    filename: function(req, file, cb) {
        cb(null, file.fieldname + '-' + +Date.now() + path.extname(file.originalname));
    }
});

app.post('/login', jsonParser, async function(req, res) {
    sendHeaders(res);
    let data = req.body;

    var user_login = req.body.login;
    var user_password = req.body.password

    const conn = await mysql.createConnection(config);
    conn.connect();
    const [rows] = await conn.execute('SELECT * FROM `users`')
    var users = rows;
    console.log(users)
    const adminData = users.find(({ login }) => login === user_login)

    if (adminData != undefined) {
        if (adminData.password == user_password) {
            var auth_token = crypto.randomBytes(15).toString('hex')
            conn.query('UPDATE `users` SET `token` = "' + auth_token + '" WHERE `users`.`login` ="' + adminData.login + '";')
            const [row] = await conn.execute('SELECT * FROM `users` WHERE `users`.`login` ="' + adminData.login + '";')
            var user = row;
            res.json({ answer: 'Authorization is successful', token: auth_token, name: user[0].first_name })

        } else {
            res.json({ answer: 'The password is incorrect' })
        }
    } else {
        res.json({ answer: 'Username not found' })
    }

    closeConnection(conn)
})


app.post('/getUserData', async function(req, res) {

    let data = req.body;
    var token = data.token;

    const conn = await mysql.createConnection(config);
    conn.connect();
    const [rows] = await conn.execute('SELECT * FROM `users` WHERE `users`.`token` ="' + token + '";')
    var user = [rows];
    sendHeaders(res);
    res.json(user)
    closeConnection(conn)
})


app.get('/getUsers', async function(req, res) {
    sendHeaders(res);

    const conn = await mysql.createConnection(config);
    conn.connect();
    const [rows] = await conn.execute('SELECT * FROM `users`')
    var users = [rows];
    res.json(users)
    closeConnection(conn)
})

app.get('/getGroups', async function(req, res) {
    sendHeaders(res);

    const conn = await mysql.createConnection(config);
    conn.connect();
    const [rows] = await conn.execute('SELECT * FROM `groups`')
    var groups = [rows];
    res.json(groups)
    closeConnection(conn)
})

app.get('/getMessages', async function(req, res) {
    sendHeaders(res);

    const conn = await mysql.createConnection(config);
    conn.connect();
    const [rows] = await conn.execute('SELECT * FROM `messages`')
    var messages = [rows][0];
    console.log(messages)
    var result = [];

    for (const element of messages) {
        const [message] = await conn.execute('SELECT * FROM ' + element.message_table + '')
        result.push({
            message_info: element,
            messages: [message][0]
        })
    }

    res.json(result)
    closeConnection(conn)
})

app.get('/getMessagesList', async function(req, res) {
    sendHeaders(res);

    const conn = await mysql.createConnection(config);
    conn.connect();
    const [rows] = await conn.execute('SELECT * FROM `messages`')
    var messages = [rows][0];

    res.json(messages)
    closeConnection(conn)
})

app.post('/getMessagesData', jsonParser, async function(req, res) {
    sendHeaders(res);
    let id = req.body.id;

    const conn = await mysql.createConnection(config);
    conn.connect();
    const [rows] = await conn.execute('SELECT * FROM `messages` WHERE `id` = "' + id + '"')
    var messages = [rows][0];

    console.log(messages)

    if (messages[0] !== undefined) {
        const [msg] = await conn.execute('SELECT * FROM `' + messages[0].message_table + '`')
        var mesg = [msg][0];

        closeConnection(conn)
        sendHeaders(res)
        res.json({
            name: messages[0].message_table,
            messages: mesg
        })
    } else {
        closeConnection(conn)
        sendHeaders(res)
        res.json([])
    }


})

app.post('/addMessages', jsonParser, async function(req, res) {
    sendHeaders(res);
    let data = req.body;

    const conn = await mysql.createConnection(config);
    const [rows] = await conn.execute('SELECT * FROM `messages` WHERE `message_table` = "' + data.presetName + '"')
    var messages = [rows][0];

    if (messages.length > 0) {
        conn.query('DROP TABLE ' + data.presetName + '')
        conn.query('DELETE FROM `messages` WHERE `message_table` = "' + data.presetName + '";')
    }

    conn.query('INSERT INTO `messages` (`id`, `message_table`) VALUES (NULL, "' + data.presetName + '");');
    conn.query('CREATE TABLE `' + data.presetName + '` (`id` int NOT NULL, `message_type` text, `message_markup` text,`message_source` text,`day` text,`time` text,`message_text` text)')
    conn.query('ALTER TABLE `' + data.presetName + '` ADD PRIMARY KEY (`id`);')
    conn.query('ALTER TABLE `' + data.presetName + '` MODIFY `id` int NOT NULL AUTO_INCREMENT;')

    for (const element of data.messages) {
        conn.query('INSERT INTO `' + data.presetName + '` (`id`, `message_type`, `message_markup`, `message_source`, `day`, `time`, `message_text`) VALUES (NULL, "' + element.message_type + '", "' + element.message_markup + '", "' + element.message_source + '", "' + element.day + '", "' + element.time + '", "' + element.message_text + '");')
    }

    closeConnection(conn)

    sendHeaders(res)
    res.json({ status: 200 })
})


app.post('/addGroup', jsonParser, async function(req, res) {
    sendHeaders(res);
    let data = req.body;

    const conn = await mysql.createConnection(config);
    const [rows] = await conn.execute('SELECT * FROM `groups` WHERE `group_name` = "' + data.groupName + '"')
    var messages = [rows][0];

    if (messages.length > 0) {
        sendHeaders(res)
        res.json({ status: 'A group with that name already exists!' })

        closeConnection(conn)

    } else {

        const [msg] = await conn.execute('SELECT * FROM `' + data.shelude + '`')
        var msgInfo = [msg][0]
        console.log(msgInfo)

        conn.query('INSERT INTO `groups` (`id`, `group_id`, `group_name`, `active_group`, `shelude`, `current_day`, `next_message_time`, `group_start_date`) VALUES (NULL, "' + data.login + '", "' + data.groupName + '", "' + 1 + '", "' + data.shelude + '", "' + 0 + '", "' + msgInfo[0].time + '", "' + data.startDate + '");');

        const [message_data] = await conn.execute('SELECT * FROM `groups`')

        closeConnection(conn)

        sendHeaders(res)
        res.json({ status: 200, data: [message_data][0] })
    }
})


app.post('/deleteGroup', jsonParser, async function(req, res) {
    sendHeaders(res);
    let data = req.body;

    const conn = await mysql.createConnection(config);

    conn.query('DELETE FROM `groups` WHERE `group_name` = "' + data.id + '";')

    const [rows] = await conn.execute('SELECT * FROM `groups`')
    var groups = [rows][0];

    sendHeaders(res)
    res.json(groups)
    closeConnection(conn)

})

app.post('/editGroup', jsonParser, async function(req, res) {
    sendHeaders(res);
    let data = req.body;

    const conn = await mysql.createConnection(config);
    conn.query('UPDATE `groups` SET `group_id` = "' + data.login + '", `group_name` = "' + data.groupName + '", `shelude` = "' + data.shelude + '", `group_start_date` = "' + data.startDate + '" WHERE `groups`.`id` ="' + data.id + '";')
    const [message_data] = await conn.execute('SELECT * FROM `groups`')
    closeConnection(conn)
    sendHeaders(res)
    res.json({ status: 200, data: [message_data][0] })

})


app.post('/deleteMessages', jsonParser, async function(req, res) {
    sendHeaders(res);
    let data = req.body;

    const conn = await mysql.createConnection(config);

    conn.query('DROP TABLE ' + data.id + '')
    conn.query('DELETE FROM `messages` WHERE `message_table` = "' + data.id + '";')

    const [rows] = await conn.execute('SELECT * FROM `messages`')
    var messages = [rows][0];
    console.log(messages)
    var result = [];

    for (const element of messages) {
        const [message] = await conn.execute('SELECT * FROM ' + element.message_table + '')
        result.push({
            message_info: element,
            messages: [message][0]
        })
    }

    sendHeaders(res)
    res.json(result)
    closeConnection(conn)


})

app.post('/uploadFile', jsonParser, async function(req, res) {
    sendHeaders(res);
    let upload = multer({ storage: storage }).single('file');
    upload(req, res, function(err) {
        if (req.file) {
            console.log(req.file)
            sendHeaders(res)
            if (req.fileValidationError) {
                return res.send(req.fileValidationError);
            }
            var imageLink = hostname + '/files/' + req.file.filename
            res.send(imageLink)
        }
    });
})


app.listen(port, () => {
    console.log(`Marathon server started! Port: ${port}`)
})

/*
var key = fs.readFileSync(__dirname + '/keys/privkey.pem');
var cert = fs.readFileSync(__dirname + '/keys/cert.pem');
var options = {
    key: key,
    cert: cert
};
var server = https.createServer(options, app);

server.listen(port, () => {
    console.log("server starting on port : " + port)
});


*/