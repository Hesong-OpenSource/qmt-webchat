/**
 * 常量
 */
var PORT = 1337;
var REDIS_HOST = '10.4.28.63';
//var REDIS_HOST = '192.168.100.101';
var REDIS_PORT = 6379;
var REDIS_DB = 2;


//var IMADAPTER_POST_URL = 'http://10.4.62.41:8080/weChatAdapter/api/v1/%s/staffService/message?timestamp=%s&signature=%s';
var IMADAPTER_POST_URL = 'http://10.4.62.42:8080/weChatAdapter/api/v1/%s/staffService/message?timestamp=%s&signature=%s';
//var IMADAPTER_LVMSG_URL = 'http://10.4.62.41:8080/weChatAdapter/api/v1/%s/leavemessage?timestamp=%s&signature=%s';
var IMADAPTER_LVMSG_URL = 'http://10.4.62.42:8080/weChatAdapter/api/v1/%s/leavemessage?timestamp=%s&signature=%s';
var FTP_HOST = "10.4.28.64";
// "10.4.28.64";
var FTP_PORT = 21;
var FTP_USER = "ftp";
//"ftp";//
var FTP_PASSWORD = "koyoo2864";
//"Koyoo2864"; //
//mysql数据库连接参数
var mysldb_host = '10.4.28.65';
 var mysqldb_port = "3306";
 var mysqldb_schema = "QuanMeiTi";
 var mysqldb_user = "quanmeiti";
 var mysqldb_password = "Ky_qmt@0414";

/*var mysldb_host = '10.4.62.41';
var mysqldb_port = "3306";
var mysqldb_schema = "hssmart";
var mysqldb_user = "root";
var mysqldb_password = "root";*/


///////////////////

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
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: REDIS_DB
});
app.use(session({
    store: sessionStore,
    secret: cookieSecret,
    resave: true,
    saveUninitialized:true
}));
var mysql = require('mysql');



var http = require('http').Server(app);
var io = require('socket.io')(http);
var captchapng = require('captchapng');
var ftpclientobj = require('ftp');
var multer = require('multer');
var ftpimgpath = "/webchat_upload_imgs/";
var allow_img = ["jpg", "jpeg", "png", "gif", "bmp"];
var fs = require("fs");
app.use(multer({
    dest: './uploadimgs/',
    limits: {
        fieldNameSize: 100,
        fileSize: 1024 * 200,
        files: 1
    },
    onFileUploadStart: function (file) {
        if (!file.extension.toLowerCase() in allow_img) return false;

    },
    onFileUploadData: function (file, data) {

    },
    onFileUploadComplete: function (file) {
        var ftpclient = new ftpclientobj();
        ftpclient.on('ready', function () {
            ftpclient.put(file.path, ftpimgpath + file.name, false, function (err) {
                fs.exists(file.path, function (isexist) {
                    if (isexist) {
                        fs.unlink(file.path, function (err) {
                            if (err) {
                                console.log("delete upload image error:", err);
                            }
                        });
                    }

                });
            });
        });
        ftpclient.on('error', function (err) {
            console.error("FTP上传错误：" + err);
            // TODO: return 5xx
        });
        ftpclient.connect({
            host: FTP_HOST,
            port: FTP_PORT,
            user: FTP_USER,
            password: FTP_PASSWORD,
            pasvTimeout: 2000,
            keepalive: 2000
        });
    },
    onParseStart: function () {
        console.log('Form parsing started at: ', new Date())
    },
    onFileSizeLimit: function (file) {
        fs.exists(file.path, function (isexist) {
            if (isexist) {
                fs.unlink(file.path, function (err) {
                    if (err) {
                        console.log("delete upload image error:", err);
                    }
                });
            }
        });
    }
}))
//从mysql数据库获取appid列表，并保存在内存变量中。
function sync_app_from_db(accname,callback) {
    var mysql_conn = mysql.createConnection({
        host: mysldb_host,
        port: mysqldb_port,
        database: mysqldb_schema,
        user: mysqldb_user,
        password: mysqldb_password
    });
    var appdata=null;
    mysql_conn.connect();
    var sqlstr = "SELECT unitid,accname,accdata,logo,work_begintime,work_endtime FROM cc_mgr_t_imacc where acctype='app' and accname='" + accname + "'";
    mysql_conn.query(sqlstr, function (err, rows, fields) {
        if (err) {
            throw err;
            return;
        }
        for (var i = 0; i < rows.length; i++) {
            var accdata = JSON.parse(rows[i].accdata);
            appdata = {
                accname:rows[i].accname,
                unit_id: rows[i].unitid,
                app_id: accdata.appid,
                app_secret: accdata.appsecret,
                logo: rows[i].logo,
                work_begintime: rows[i].work_begintime,
                work_endtime: rows[i].work_endtime
            };
        }
        callback(appdata);
    });

    mysql_conn.end();
}

/// 接收QMT IM消息，并发往浏览器。
app.post('/qmtapi/staffService/message', function (req, res) {
    console.log('Recv FROM QMT: ', req.get('Content-Type'), req.query, req.body);

    /// 转发
    var data = req.body;
    var sid = data.ToUserId;

    sessionStore.load(sid, function (err, session) {
        if (err || !session) {
            res.status(500).send({
                errcode: 0,
                errmsg: err
            });

        } else {
            console.log("send to io ", session.ioid);
            console.log("send to socked client message:", data);
            io.to(session.ioid).emit('ImMessage', data);
            res.status(200).send({
                errcode: 0,
                errmsg: 'ok'
            });
        }
    });


});


function sendmsg_to_qmt(data, req, res) {
    console.log("req.originalUrl:", req.originalUrl);
    var APP_ID = req.session.app_id;
    var APP_SECRET = req.session.app_secret;
    /*if (req.originalUrl == "/sendmsg_kyh") {
     APP_ID = "kyh";
     APP_SECRET = "abcdef";
     } else {
     APP_ID = "webchat";
     APP_SECRET = "abcdef";
     }*/
    console.log("APP_ID is :", APP_ID);
    console.log("APP_SECRET is:", APP_SECRET);
    req.session.touch();
    var sha1 = crypto.createHash('sha1');
    sha1.update(APP_ID);
    sha1.update(APP_SECRET);
    var d = new Date();
    var timestamp = d.getTime().toString();
    sha1.update(timestamp);
    var signature = sha1.digest('hex');
    /// POST 到全媒体 IM WEBAPI
    // 用 socketio 的 ID 当作 FromUserIDv
    // var data = req.body;
    data.FromUserId = req.sessionID;
    var qmturl = util.format(IMADAPTER_POST_URL, APP_ID, timestamp, signature);
    console.log("send to qmt message:", data);
    console.log("send to qmt url:", qmturl)
    request.post({
            uri: qmturl,
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
            res.status(200).send(JSON.stringify(null));
        }
    );
}
function leave_a_message_to_qmt(data, req, res) {
    req.session.touch();
    var APP_ID = req.session.app_id;
    var APP_SECRET = req.session.app_secret;
    var sha1 = crypto.createHash('sha1');
    sha1.update(APP_ID);
    sha1.update(APP_SECRET);
    var d = new Date();
    var timestamp = d.getTime().toString();
    sha1.update(timestamp);
    var signature = sha1.digest('hex');
    /// POST 到全媒体 IM WEBAPI
    // 用 socketio 的 ID 当作 FromUserIDv
    // var data = req.body;
    data.FromUserId = req.sessionID;
    var qmturl = util.format(IMADAPTER_LVMSG_URL, APP_ID, timestamp, signature);
    console.log("send to qmt leave a message:", data);
    console.log("send to qmt url:", qmturl)
    request.post({
            uri: qmturl,
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
            res.status(200).send(JSON.stringify({desc: "留言提交成功"}));
        }
    );
}
io.use(function (socket, next) {
    if (socket.request.headers.cookie) return next();
    next(new Error('Authentication error'));
});
io.on('connection', function (socket) {

    socket.on('disconnect', function () {

    });
    try {
        var signedCookies = require('express/node_modules/cookie').parse(socket.request.headers.cookie)['connect.sid'];
        var sid = signedCookies.split(':')[1].split('.')[0];
        sessionStore.load(sid, function (err, session) {
            if (err || !session) {
                socket.close();

            } else {
                session.ioid = socket.id;
                sessionStore.set(sid, session);
            }
        });
    } catch (ex) {
        console.error(ex);
        socket.close();
    }

});
/*
 var makeUUID = function () {
 var S4 = function () {
 return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
 };
 return (S4() + S4() + S4() + S4() + S4() + S4() + S4() + S4()).toUpperCase();
 }
 */
app.post("/uploadfile", function (req, res, next) {
    var imgurl = ftpimgpath + req.files.Filedata.name;
    var filesize = req.files.Filedata.size;
    if (filesize >= 204800) {
        res.status(400).send("图片文件不能超过200k");
    } else {
        var allowpic = false;
        for (var i = 0; i < allow_img.length; i++) {
            if (allow_img[i] == req.files.Filedata.extension.toLowerCase()) {
                allowpic = true;
                sendmsg_to_qmt({Content: imgurl, FromUserName: "光头强", MsgType: "image"}, req, res);
                break;
            }
        }
        if (!allowpic) {
            var str = "图片格式必须为:";
            for (var i = 0; i < allow_img.length; i++) {
                if (i < (allow_img.length - 1)) {
                    str = str + allow_img[i] + ",";
                } else {
                    str = str + allow_img[i];
                }

            }
            res.status(400).send(str);
        }
    }


});
app.post("/sendmsg", function (req, res, next) {
    if (req.session.authed) {
        if (req.body.Content) {
            if (req.body.Content.length > 500) {
                res.status(200).send(JSON.stringify({desc: "一次发送内容不能超过500个文字！"}));
                return;
            }
        }
        var cTime = new Date();
        if (req.session.last_msg_time) {
            var timelen = cTime.getTime() - Date.parse(req.session.last_msg_time);
            if (timelen < 1000) {
                //TODO:提示客户端间隔
                res.status(200).send(JSON.stringify({desc: "亲，别急，喝口茶先！"}));
                return;
            }
        }
        req.session.last_msg_time = cTime;
        sendmsg_to_qmt(req.body, req, res);

    } else {
        res.status(403).send();
    }
});

app.post("/savemessages", function (req, res, next) {
    if(!req.session.app_id){
        res.status(200).send(JSON.stringify({desc: "appname不存在"}));
        return;
    }
    if (req.body.content) {
        if (req.body.content.length > 2000) {
            res.status(200).send(JSON.stringify({desc: "一次发送内容不能超过2000个文字！"}));
            return;
        }
    }
    var cTime = new Date();
    if (req.session.last_msg_time) {
        var timelen = cTime.getTime() - Date.parse(req.session.last_msg_time);
        if (timelen < 1000) {
            //TODO:提示客户端间隔
            res.status(200).send(JSON.stringify({desc: "亲，休息一下吧，您重复提交间隔太快了！"}));
            return;
        }
    }
    req.session.last_msg_time = cTime;
    leave_a_message_to_qmt(req.body, req, res);

});
app.get("/authed", function (req, res, next) {
    req.session.authed = true; //禁用验证码功能，如果需要恢复验证码功能，删除此行即可
    var accname = req.query.accname;
    var logo = null;
    sync_app_from_db(accname,function(appdata){
        if (appdata!=null) {
            req.session.app_id = appdata.app_id;
            req.session.app_secret = appdata.app_secret;
            logo = appdata.logo;
            work_begintime=appdata.work_begintime;
            work_endtime=appdata.work_endtime;
            res.status(200).send(JSON.stringify({authed: true, logo: logo,work_begintime:work_begintime,work_endtime:work_endtime}));
        } else {
            res.status(200).send(JSON.stringify({authed: false, desc: "appname不存在"}));
        }
    });

});
app.route('/captcha').get(function (req, res, next) {
    if (req.session.captcha_val) {
        console.log('pre-val in session is ', req.session.captcha_val);
    }
    if (req.session.tag) {
        console.log("session tag is ", req.session.tag);
    }
    var captchaValue = parseInt(Math.random() * 9000 + 1000);
    var p = new captchapng(50, 18, captchaValue); // width,height,numeric captcha

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
http.listen(PORT, function () {
    console.log('listening on *:' + PORT);
});


