var util = require('util');
var crypto = require('crypto');

var request = require('request');

var express = require('express');
var app = express();
app.use('/app', express.static('../client/app'));
var bodyParser = require('body-parser')
app.use(bodyParser.json());
var cookieParser = require('cookie-parser')
var cookieSecret = "tyuio";
app.use(cookieParser(cookieSecret));
var session = require('express-session');
var RedisStore = require('connect-redis')(session);
var sessionStore = new RedisStore({
    host: '10.4.62.42',
    port: 6379,
    db: 2
});
app.use(session({
    store: sessionStore,
    secret:cookieSecret
}));
/*var cookie_session = require('cookie-session');
 app.use(cookie_session({
 secret:cookieSecret,
 keys: ['sid']
 }));*/

var http = require('http').Server(app);
var io = require('socket.io')(http);
var captchapng = require('captchapng');

/**
 * 全局变量
 */
var io_sessions = [];
var g_session = {};
var appid = '1002';
var appsecret = 'abcdef';

// /// 测试用的首页
// app.get('/', function(req, res) {
//     res.sendFile('./index.html', {
//         root: '../client/app'
//     });
// });

/// 接收QMT IM消息，并发往浏览器。
app.post('/qmtapi/staffService/message', function (req, res) {
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
    var sid = data.ToUserId;
    sessionStore.load(sid, function(err, session){
        if (err || !session) {
            res.status(500).send({
                errcode: 0,
                errmsg: err
            });

        }else{
            console.log("send to io ",session.ioid);
            io.to(session.ioid).emit('ImMessage', data);
            res.status(200).send({
                errcode: 0,
                errmsg: 'ok'
            });
        }
    });


});


io.use(function (socket, next) {
    if (socket.request.headers.cookie) return next();
    next(new Error('Authentication error'));
});
io.on('connection', function (socket) {

    socket.on('disconnect', function () {

    });
    try{
        var signedCookies = require('express/node_modules/cookie').parse(socket.request.headers.cookie)['connect.sid'];
        var sid = signedCookies.split(':')[1].split('.')[0];
        sessionStore.load(sid, function (err, session) {
            if (err || !session) {
                socket.close();

            }else{
                session.ioid = socket.id;
                sessionStore.set(sid, session);
            }
        });
    }catch (ex){
        console.error(ex);
        socket.close();
    }


    //接收浏览器的消息，并发送到qmt im中。
  /*  socket.on('ImMessage', function (data) {
        console.log(socket.id + ': Send to QMT: ' + data);
        var signedCookies = require('express/node_modules/cookie').parse(socket.request.headers.cookie)['connect.sid'];
        var sid = signedCookies.split(':')[1].split('.')[0];
        sessionStore.load(sid, function (err, session) {
            if (err || !session) {
                socket.close();

            } else {

                if(session.authed){
                    // 全媒体 IM WEBAPI 的签名
                    var sha1 = crypto.createHash('sha1');
                    sha1.update(appid);
                    sha1.update(appsecret);
                    var d = new Date();
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
                            json: true
                        },
                        function (error, response, body) {
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
                }else{
                    socket.close();
                }

            }
        });


        // for (var i in io_sessions) {
        //     var sock_id = io_sessions[i];
        //     console.log(sock_id);
        //     io.to(sock_id).emit('chat message', socket.id + ': ' + msg)
        // }
    });*/
});
/*
var makeUUID = function () {
    var S4 = function () {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    };
    return (S4() + S4() + S4() + S4() + S4() + S4() + S4() + S4()).toUpperCase();
}
*/
app.post("/sendmsg",function(req,res,next){
    if(req.session.authed){
        req.session.touch();
        var sha1 = crypto.createHash('sha1');
        sha1.update(appid);
        sha1.update(appsecret);
        var d = new Date();
        var timestamp = d.getTime().toString();
        sha1.update(timestamp);
        var signature = sha1.digest('hex');
        /// POST 到全媒体 IM WEBAPI
        // 用 socketio 的 ID 当作 FromUserIDv
        var data=req.body;
        data.FromUserId = req.sessionID;
        request.post({
                uri: util.format('http://10.4.62.41:8080/weChatAdapter/api/v1/%s/staffService/message?timestamp=%s&signature=%s',
                    appid, timestamp, signature),
                body: data,
                json: true
            },
            function (error, response, body) {
                if (error) {
                    res.status(500).send(error);
                    return console.error(error, body);
                } else {
                    if (body.errcode != 0) {
                        res.status(500).send(body);
                        return console.error(body);
                    }
                }
                console.log(body);
                res.status(200).send();
            }
        );
    }else{
        res.status(403).send();
    }
});

app.route('/captcha').get(function (req, res, next) {
    if (req.session.captcha_val) {
        console.log('pre-val in cookie is ', req.session.captcha_val);
    }
    if (req.session.tag) {
        console.log("session tag is ", req.session.tag);
    }
    var captchaValue = parseInt(Math.random() * 9000 + 1000);
    var p = new captchapng(60, 25, captchaValue); // width,height,numeric captcha

    p.color(0, 0, 0, 0);  // First color: background (red, green, blue, alpha)
    p.color(80, 80, 80, 255); // Second color: paint (red, green, blue, alpha)

    var img = p.getBase64();
    var imgbase64 = new Buffer(img, 'base64');
    req.session.captcha_val = captchaValue;
    //req.session.tag = makeUUID();
    res.set('Content-Type', 'image/png');
    res.status(200).send(imgbase64);
}).post(function (req, res, next) {
    var data = req
    console.log("submit captcha is ", data.body.captcha);
    if (data.body.captcha == req.session.captcha_val) {
        delete req.session.captcha_val;
        //var guid=makeUUID();
        req.session.authed = true;
        res.status(200).send({result: true});
    } else {
        res.status(200).send({result: false});
    }

});
http.listen(3000, function () {
    console.log('listening on * : 3000');
});


