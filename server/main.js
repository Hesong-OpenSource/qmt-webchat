var util = require('util');
var crypto = require('crypto');

var request = require('request');

var express = require('express');
var app = express();
app.use('/app', express.static('../client/app'));
var bodyParser = require('body-parser')
app.use(bodyParser.json());
var http = require('http').Server(app);
var io = require('socket.io')(http);

/**
 * 全局变量
 */
var io_sessions = [];
var appid = '1001';
var appsecret = 'abcdef';

// /// 测试用的首页
// app.get('/', function(req, res) {
//     res.sendFile('./index.html', {
//         root: '../client/app'
//     });
// });

/// 接收IM消息
app.post('/qmtapi/staffService/message', function(req, res) {
    console.log('Recv FROM QMT: ', req.get('Content-Type'), req.query, req.body);
    /// 验证
    // var timestamp = req.query.timestamp;
    // var signature = req.query.signature;
    // var sha1 = crypto.createHash('sha1');
    // sha1.update(appid);
    // sha1.update(appsecret);
    // sha1.update(timestamp);
    // var sig = sha1.digest('hex');
    // if (signature != sig) {
    //     res.send(403);
    //     return;
    // }
    /// 转发
    var data = req.body;
    io.to(data.ToUserId).emit('ImMessage', data);
    res.status(200).send({
        errcode: 0,
        errmsg: 'ok'
    });
});

io.on('connection', function(socket) {
    io_sessions.push(socket.id);

    socket.on('disconnect', function() {
        var i = io_sessions.indexOf(socket.id);
        if (i > -1) {
            io_sessions.splice(i, 1);
        }
    });

    socket.on('ImMessage', function(data) {
        console.log(socket.id + ': Send to QMT: ' + data);

        // 全媒体 IM WEBAPI 的签名
        var sha1 = crypto.createHash('sha1');
        sha1.update(appid);
        sha1.update(appsecret);
        var d = new Date()
        var timestamp = d.getTime().toString();
        sha1.update(timestamp);
        var signature = sha1.digest('hex');
        /// POST 到全媒体 IM WEBAPI
        // 用 socketio 的 ID 当作 FromUserID
        data.FromUserId = socket.id;
        request.post({
                uri: util.format('http://10.4.62.41:8080/weChatAdapter/api/v1/%s/staffService/message?timestamp=%s&signature=%s',
                    appid, timestamp, signature),
                body: data,
                json: true,
            },
            function(error, response, body) {
                if (error) {
                    return console.error(error, body);
                } else {
                    if (body.errcode != 0) {
                        console.error(body);
                    }
                }
                console.log(body);
            }
        );

        // for (var i in io_sessions) {
        //     var sock_id = io_sessions[i];
        //     console.log(sock_id);
        //     io.to(sock_id).emit('chat message', socket.id + ': ' + msg)
        // }
    });
});

http.listen(3000, function() {
    console.log('listening on *:3000');
});